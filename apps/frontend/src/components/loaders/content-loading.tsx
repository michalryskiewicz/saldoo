import { HashLoader } from 'react-spinners';

type ContentLoadingProps = {
  loading?: boolean;
};

export default function ContentLoading({ loading = true }: ContentLoadingProps) {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <HashLoader loading={loading} size={100} aria-label="Loading Spinner" data-testid="loader" />
    </div>
  );
}
