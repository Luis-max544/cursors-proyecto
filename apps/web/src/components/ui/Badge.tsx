interface BadgeProps {
  children: React.ReactNode
  variant?: 'premium' | 'category' | 'status'
}

const variantClasses = {
  premium: 'bg-yellow-100 text-yellow-800 border border-yellow-300',
  category: 'bg-blue-50 text-blue-700 border border-blue-200',
  status: 'bg-gray-100 text-gray-700',
}

export function Badge({ children, variant = 'status' }: BadgeProps) {
  return (
    <span className={`inline-block rounded px-1.5 py-0.5 text-xs font-medium ${variantClasses[variant]}`}>
      {children}
    </span>
  )
}
