import { AlertTriangle, RefreshCw } from "lucide-react";

interface ApiErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
}

const ApiErrorState = ({
  title = "Data loading failed",
  message = "Could not fetch data from the server.",
  onRetry,
  compact = false,
}: ApiErrorStateProps) => {
  return (
    <div
      className={`rounded-xl border border-red-200 bg-red-50 text-red-700 ${
        compact ? "p-4" : "p-6"
      }`}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold">{title}</h3>
          <p className="text-sm mt-1">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-100 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ApiErrorState;
