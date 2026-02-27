export function SkeletonLine({ width = "w-full" }: { width?: string }) {
  return (
    <div className={`h-4 ${width} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`} />
  );
}

export function SkeletonCircle({ size = "w-10 h-10" }: { size?: string }) {
  return (
    <div className={`${size} bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse`} />
  );
}

export function SkeletonCard() {
  return (
    <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
      <div className="flex items-center gap-3 mb-4">
        <SkeletonCircle />
        <div className="flex-1 space-y-2">
          <SkeletonLine width="w-1/3" />
          <SkeletonLine width="w-1/4" />
        </div>
      </div>
      <div className="space-y-2">
        <SkeletonLine />
        <SkeletonLine width="w-3/4" />
        <SkeletonLine width="w-1/2" />
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <SkeletonLine width="w-16" />
            <div className="mt-2 h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
          </div>
        ))}
      </div>
      {/* Level progress */}
      <div className="p-6 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
        <SkeletonLine width="w-40" />
        <div className="mt-4 h-3 w-full bg-gray-200 dark:bg-gray-700 rounded-full" />
      </div>
      {/* Recent sessions */}
      <div className="space-y-3">
        <SkeletonLine width="w-32" />
        {[...Array(3)].map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}

export function SessionListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <SkeletonCircle />
          <div className="flex-1 space-y-2">
            <SkeletonLine width="w-1/3" />
            <SkeletonLine width="w-1/4" />
          </div>
          <SkeletonLine width="w-20" />
        </div>
      ))}
    </div>
  );
}

export function ProgressSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Skill overview */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center p-4">
            <div className="w-20 h-20 rounded-full border-4 border-gray-200 dark:border-gray-700 mb-2" />
            <SkeletonLine width="w-16" />
          </div>
        ))}
      </div>
      {/* Concept list */}
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-gray-800">
            <SkeletonLine width="w-1/4" />
            <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full" />
            <SkeletonLine width="w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
