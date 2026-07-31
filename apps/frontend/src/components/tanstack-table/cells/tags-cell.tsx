import { Badge } from '@/components/ui/badge.tsx';

type TagsCellProps = {
  tags?: string[] | undefined;
  tag?: string;
};

export default function TagsCell({ tags, tag }: TagsCellProps) {
  if (tag) {
    return (
      <div className="inline-flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-muted-foreground px-1.5">
          {tag}
        </Badge>
      </div>
    );
  }

  if (!tags?.length) {
    return null;
  }

  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      {tags?.map((tag: string) => {
        return (
          <Badge key={tag} variant="outline" className="text-muted-foreground px-1.5">
            {tag}
          </Badge>
        );
      })}
    </div>
  );
}
