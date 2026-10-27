import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import type {
  ArticleInput,
  ArticleQuery,
  CategoryInput,
  TagInput,
  Article,
} from '@screenwise/shared';
import { mediaPathSchema } from '@screenwise/shared';
import { env } from '../../config/env.js';
import { AppError } from '../../utils/app-error.js';
import { logger } from '../../utils/logger.js';
import { LibraryRepository } from './library.repository.js';
import {
  sanitizeArticleDocument,
  articleReadingTime,
  articleImageUrls,
} from './content.service.js';

export async function normalizeArticleImage(
  file: Pick<Express.Multer.File, 'buffer' | 'mimetype' | 'size'> | undefined,
) {
  if (
    !file ||
    file.size > 5 * 1024 * 1024 ||
    !['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)
  )
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'Choose a JPEG, PNG, or WebP image up to 5 MB.',
    );
  try {
    const image = sharp(file.buffer, {
      limitInputPixels: 16777216,
      animated: false,
    });
    const meta = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(meta.format ?? '') ||
      'image/' + meta.format !== file.mimetype ||
      (meta.pages ?? 1) > 1
    )
      throw new Error('Unsupported image');
    return await image
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    throw new AppError(
      400,
      'INVALID_IMAGE',
      'The image is invalid, animated, or exceeds supported dimensions.',
    );
  }
}
export class LibraryService {
  constructor(private repo: LibraryRepository) {}
  articles(q: ArticleQuery, admin = false) {
    return this.repo.articles(q, admin);
  }
  article(key: string, admin = false) {
    return this.repo.article(key, admin);
  }
  async related(slug: string) {
    return this.repo.related(await this.repo.article(slug));
  }
  categories(admin = false) {
    return this.repo.categories(admin);
  }
  tags() {
    return this.repo.tags();
  }
  saveCategory(body: CategoryInput, id?: string) {
    return this.repo.saveCategory(body, id);
  }
  deactivateCategory(id: string) {
    return this.repo.deactivateCategory(id);
  }
  saveTag(body: TagInput, id?: string) {
    return this.repo.saveTag(body, id);
  }
  deleteTag(id: string) {
    return this.repo.deleteTag(id);
  }
  private mediaPaths(content: ArticleInput['content']) {
    return articleImageUrls(content).map((url) => {
      const prefix = this.repo.publicUrl('articles/');
      if (!url.startsWith(prefix))
        throw new AppError(
          400,
          'INVALID_IMAGE',
          'Insert images uploaded to the article media library.',
        );
      return mediaPathSchema.parse('articles/' + url.slice(prefix.length));
    });
  }
  async save(body: ArticleInput, id?: string) {
    if (id && !body.revision)
      throw new AppError(
        400,
        'REVISION_REQUIRED',
        'Reload the article before saving.',
      );
    const content = sanitizeArticleDocument(body.content);
    const metrics = articleReadingTime(
      content,
      env.ARTICLE_READING_WORDS_PER_MINUTE,
    );
    const media_paths = [
      ...new Set([
        ...this.mediaPaths(content),
        ...(body.cover_image_path ? [body.cover_image_path] : []),
      ]),
    ];
    const media = await this.repo.mediaByPaths(media_paths);
    if (media.length !== media_paths.length)
      throw new AppError(
        400,
        'INVALID_IMAGE',
        'An image is unavailable. Upload or select an available image.',
      );
    const previous = id ? await this.repo.article(id, true) : null;
    if (
      previous &&
      (previous.revision !== body.revision || previous.status === 'ARCHIVED')
    )
      throw new AppError(
        409,
        'CONTENT_CONFLICT',
        'This article changed or is archived. Reload before saving.',
      );
    const { revision, ...definition } = body;
    const saved = await this.repo.saveArticle(
      { ...definition, content, ...metrics, media_paths },
      id,
      revision,
    );
    if (previous) {
      const oldPaths = [
        ...this.mediaPaths(previous.content),
        ...(previous.cover_image_path ? [previous.cover_image_path] : []),
      ];
      for (const path of new Set(
        oldPaths.filter((p) => !media_paths.includes(p)),
      )) {
        try {
          const old = (await this.repo.mediaByPaths([path]))[0];
          if (old) await this.deleteMedia(old.id);
        } catch (error) {
          if (!(error instanceof AppError && error.status === 409))
            logger.warn('Unused article image cleanup deferred');
        }
      }
    }
    return saved;
  }
  async transition(id: string, revision: number, status: Article['status']) {
    const current = await this.repo.article(id, true);
    if (current.revision !== revision)
      throw new AppError(
        409,
        'CONTENT_CONFLICT',
        'This article changed. Reload before continuing.',
      );
    return this.repo.transition(id, revision, status);
  }
  bookmarks(q: ArticleQuery) {
    return this.repo.bookmarks(q);
  }
  bookmark(id: string) {
    return this.repo.bookmark(id);
  }
  removeBookmark(id: string) {
    return this.repo.removeBookmark(id);
  }
  media(q: ArticleQuery) {
    return this.repo.media(q);
  }
  async upload(file: Express.Multer.File | undefined) {
    const buffer = await normalizeArticleImage(file),
      id = randomUUID(),
      path = 'articles/' + id + '.webp';
    const storage = this.repo.admin.storage.from('article-media');
    const { error } = await storage.upload(path, buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (error)
      throw new AppError(
        503,
        'UPLOAD_FAILED',
        'Unable to upload. Confirm the article-media bucket is configured.',
      );
    try {
      return {
        ...(await this.repo.insertMedia(id, path)),
        url: this.repo.publicUrl(path),
      };
    } catch (error) {
      await storage.remove([path]);
      throw error;
    }
  }
  async deleteMedia(id: string) {
    const { media, inUse } = await this.repo.mediaDeletionState(id);
    if (inUse || media.status !== 'READY')
      throw new AppError(
        409,
        'CONTENT_IN_USE',
        'This image is still used by an article or is being removed.',
      );
    const path = await this.repo.reserveMedia(id);
    const { error } = await this.repo.admin.storage
      .from('article-media')
      .remove([path]);
    if (error) {
      await this.repo.restoreMedia(id);
      throw new AppError(
        503,
        'MEDIA_DELETE_FAILED',
        'Image removal failed. Try again later.',
      );
    }
    await this.repo.deleteMediaRecord(id);
    return { id, deleted: true };
  }
  summary() {
    return this.repo.summary();
  }
}
