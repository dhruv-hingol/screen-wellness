import type {
  ProfilePatch,
  PreferencesPatch,
  OnboardingInput,
  GoalKey,
  UserProfile,
} from '@screenwise/shared';
import sharp from 'sharp';
import { randomUUID } from 'node:crypto';
import { UserRepository } from './user.repository.js';
import { getAdminClient } from '../../config/supabase.js';
import { AppError } from '../../utils/app-error.js';
export class UserService {
  constructor(
    private repository: UserRepository,
    private userId: string,
  ) {}
  private async withAvatar(profile: UserProfile) {
    if (!profile.avatar_url) return profile;
    if (!profile.avatar_url.startsWith(this.userId + '/'))
      throw new AppError(
        503,
        'AVATAR_UNAVAILABLE',
        'Unable to load your avatar.',
      );
    const { data, error } = await getAdminClient()
      .storage.from('avatars')
      .createSignedUrl(profile.avatar_url, 3600);
    if (error)
      throw new AppError(
        503,
        'AVATAR_UNAVAILABLE',
        'Unable to load your avatar.',
      );
    return { ...profile, avatar_url: data.signedUrl };
  }
  async profile() {
    return this.withAvatar(await this.repository.profile());
  }
  preferences() {
    return this.repository.preferences();
  }
  goals() {
    return this.repository.goals();
  }
  async onboarding() {
    const [profile, preferences, goals] = await Promise.all([
      this.profile(),
      this.preferences(),
      this.goals(),
    ]);
    return { profile, preferences, goals };
  }
  async updateProfile(input: ProfilePatch) {
    return this.withAvatar(await this.repository.updateProfile(input));
  }
  updatePreferences(input: PreferencesPatch) {
    return this.repository.updatePreferences(input);
  }
  replaceGoals(goals: GoalKey[]) {
    return this.repository.replaceGoals(goals);
  }
  async submitOnboarding(input: OnboardingInput) {
    await this.repository.submitOnboarding(input);
    return this.onboarding();
  }
  async avatar(file: Express.Multer.File | undefined) {
    if (!file)
      throw new AppError(
        400,
        'INVALID_FILE',
        'Choose a PNG, JPEG, or WebP image up to 2 MB.',
      );
    let buffer: Buffer;
    try {
      const image = sharp(file.buffer, { limitInputPixels: 16777216 });
      const metadata = await image.metadata();
      if (!['png', 'jpeg', 'webp'].includes(metadata.format ?? ''))
        throw new Error('Unsupported format');
      buffer = await image
        .rotate()
        .resize(512, 512, { fit: 'cover', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw new AppError(
        400,
        'INVALID_FILE',
        'The image is invalid or exceeds supported dimensions.',
      );
    }
    const storage = getAdminClient().storage.from('avatars');
    const previous = (await this.repository.profile()).avatar_url;
    const path = this.userId + '/' + randomUUID() + '.webp';
    const { error } = await storage.upload(path, buffer, {
      contentType: 'image/webp',
      upsert: false,
    });
    if (error)
      throw new AppError(503, 'UPLOAD_FAILED', 'Unable to upload your avatar.');
    try {
      await this.repository.setAvatar(path);
    } catch (error) {
      await storage.remove([path]);
      throw error;
    }
    if (previous?.startsWith(this.userId + '/'))
      await storage.remove([previous]);
    return this.profile();
  }
}
