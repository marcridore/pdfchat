export default function Notification({ notification, onClose }) {
  if (!notification) return null

  return (
    <div 
      className={`fixed top-4 right-4 p-4 rounded-lg shadow-xl z-50 flex items-center backdrop-blur-sm ${
        notification.type === 'error' ? 'bg-red-500/90' : 'bg-blue-500/90'
      } text-white max-w-md transform transition-all duration-300 ease-out`}
    >
      <span className="flex-1 mr-2">{notification.message}</span>
      <button 
        onClick={onClose}
        className="ml-2 text-white/80 hover:text-white p-1.5 rounded-full hover:bg-white/10 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
} 