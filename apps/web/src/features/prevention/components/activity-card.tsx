import { Link } from 'react-router';
import {
  Eye,
  PersonStanding,
  Footprints,
  Moon,
  Leaf,
  Heart,
} from 'lucide-react';
import type { Activity } from '@screenwise/shared';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
export const activityIcons = {
  EYE_COMFORT: Eye,
  POSTURE: PersonStanding,
  MOVEMENT: Footprints,
  SLEEP: Moon,
  DIGITAL_BREAK: Leaf,
  GENERAL: Heart,
};
export const activityCategoryLabels = {
  EYE_COMFORT: 'Eye comfort',
  POSTURE: 'Posture',
  MOVEMENT: 'Movement',
  SLEEP: 'Sleep hygiene',
  DIGITAL_BREAK: 'Digital breaks',
  GENERAL: 'General wellness',
};
export function ActivityCard({
  activity: a,
  completed = false,
  source = 'MANUAL',
  completionLabel = 'Completed today',
}: {
  activity: Activity;
  completed?: boolean;
  source?: string;
  completionLabel?: string;
}) {
  const Icon = activityIcons[a.category];
  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <Icon className="text-primary" size={30} />
          <Badge variant={completed ? 'default' : 'secondary'}>
            {completed ? completionLabel : activityCategoryLabels[a.category]}
          </Badge>
        </div>
        <h2 className="text-xl font-semibold">{a.title}</h2>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {a.description}
        </p>
        <p className="text-xs text-muted-foreground">
          {a.duration_seconds < 60
            ? a.duration_seconds + ' seconds'
            : Math.ceil(a.duration_seconds / 60) + ' minutes'}{' '}
          · {a.difficulty}
        </p>
        <Button asChild variant={completed ? 'outline' : 'default'}>
          <Link to={'/prevention/' + a.id + '?source=' + source}>
            {completed ? 'View instructions' : 'Start activity'}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
