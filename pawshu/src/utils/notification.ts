/**
 * Custom notification utility for displaying attractive toast notifications
 */

/**
 * Shows a custom notification with a green checkmark
 * @param title The title of the notification
 * @param message The message to display
 */
export const showSuccessNotification = (title: string, message: string) => {
  // Create notification element
  const notificationDiv = document.createElement('div');
  notificationDiv.className = 'fixed top-4 right-4 bg-green-600 text-white shadow-lg rounded-lg p-0 z-50 animate-slide-in flex items-center';
  notificationDiv.style.maxWidth = '350px';
  notificationDiv.innerHTML = `
    <div class="flex-shrink-0 bg-white rounded-full p-2 m-2">
      <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <div class="py-2 pl-1 pr-4">
      <p class="font-medium">${title}</p>
      <p class="text-sm text-green-100">${message}</p>
    </div>
  `;
  
  // Add to document
  document.body.appendChild(notificationDiv);
  
  // Add animation styles
  const style = document.createElement('style');
  style.innerHTML = `
    @keyframes slide-in {
      0% { transform: translateX(100%); opacity: 0; }
      100% { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out forwards;
    }
    @keyframes fade-out {
      0% { opacity: 1; }
      100% { opacity: 0; }
    }
    .animate-fade-out {
      animation: fade-out 0.3s ease-out forwards;
    }
  `;
  document.head.appendChild(style);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    notificationDiv.classList.add('animate-fade-out');
    setTimeout(() => {
      if (document.body.contains(notificationDiv)) {
        document.body.removeChild(notificationDiv);
      }
    }, 300);
  }, 3000);
};

// Predefined notification messages
export const NOTIFICATIONS = {
  DONATION: {
    title: 'Thank You for Your Donation!',
    message: 'Your support helps make a difference for animals in need.'
  },
  PURCHASE: {
    title: 'Purchase Successful!',
    message: 'Your order has been placed and is being processed.'
  },
  CART_ADD: {
    title: 'Added to Cart',
    message: 'Item has been added to your shopping cart.'
  },
  WISHLIST_ADD: {
    title: 'Added to Wishlist',
    message: 'Item has been added to your wishlist.'
  }
}; 