import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// Base URL for the API - fixing potential typo in IP address
// Standard local network IP typically starts with 192.168.x.x
const API_BASE_URL = 'http://192.169.0.104:8000/api'; // Corrected IP address

/**
 * Add query parameters to a URL
 * @param {string} url - Base URL
 * @param {Object} params - Query parameters
 * @returns {string} - URL with query parameters
 */
const addQueryParams = (url, params = {}) => {
  // Filter out undefined and null values
  const filteredParams = Object.fromEntries(
    Object.entries(params).filter(([_, value]) => value !== undefined && value !== null)
  );
  
  if (Object.keys(filteredParams).length === 0) return url;
  
  const queryString = new URLSearchParams(filteredParams).toString();
  return `${url}${url.includes('?') ? '&' : '?'}${queryString}`;
};

// Add a method to set auth token and debug connection
class Api {
  constructor() {
    // Initialize with empty state
    this._authToken = null;
    this._userCache = null;
  }
  /**
   * Set the auth token for API requests
   * @param {string} token - Auth token
   */
  async setAuthToken(token) {
    this._authToken = token;
    // Also ensure token is persisted to storage
    if (token) {
      await AsyncStorage.setItem('authToken', token);
    }
  }

  /**
   * Clear all API state including auth token and cached user data
   * This should be called on logout
   */
  clearState() {
    this._authToken = null;
    this._userCache = null;
  }
  /**
   * Make a request to the API
   * @param {string} endpoint - API endpoint
   * @param {Object} options - Fetch options
   * @param {Object} queryParams - Query parameters to add to the URL
   * @param {boolean} isRetry - Whether this is a retry attempt after token refresh
   * @returns {Promise<any>} - Response data
   */
  async fetch(endpoint, options = {}, queryParams = {}, isRetry = false) {
    // Get the auth token - prioritize memory cache for performance
    let token = this._authToken;
    
    // If no token in memory, try to get it from storage
    if (!token) {
      token = await AsyncStorage.getItem('authToken');
      // Update memory cache if found in storage
      if (token) {
        this._authToken = token;
      }
    }
    
    // Set headers
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    // Add auth token if available
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Add query parameters to the URL
    const url = addQueryParams(`${API_BASE_URL}/${endpoint}`, queryParams);
    
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });
      
      // Check if the response is JSON
      const contentType = response.headers.get('content-type');
      const isJson = contentType && contentType.includes('application/json');
      
      // Handle 401 Unauthorized error - token might be expired
      if (response.status === 401 && !isRetry) {
        console.log('Token expired, attempting to refresh...');
        try {
          // Try to refresh the token
          const refreshData = await this.refreshToken();
          // Update the token in memory
          this._authToken = refreshData.access;
          // Store the new token
          await AsyncStorage.setItem('authToken', refreshData.access);
          
          // Dispatch a custom event for token refresh success 
          // (this will be useful for showing a subtle message)
          if (global.EventEmitter) {
            global.EventEmitter.emit('tokenRefreshSuccess');
          }
          
          // Retry the original request with the new token
          return this.fetch(endpoint, options, queryParams, true);
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          // If refresh fails, the user needs to log in again
          // Clear tokens
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('refreshToken');
          this._authToken = null;
          
          // Dispatch a session expired event that the auth system can listen for
          if (global.EventEmitter) {
            global.EventEmitter.emit('sessionExpired', 'Your session has expired. Please log in again.');
          }
          
          throw {
            status: 401,
            message: 'Your session has expired. Please log in again.',
            originalError: refreshError,
            __handled: true // Mark as handled so we can prevent duplicate error messages
          };
        }
      }
      
      // Parse the response
      const data = isJson ? await response.json() : await response.text();
      
      // Handle error responses
      if (!response.ok) {
        console.error('API error:', response.status, data);
        throw {
          status: response.status,
          data,
          message: data.detail || 'Something went wrong',
        };
      }
      
      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  
  // Authentication methods
    /**
   * Login with phone number and password
   * @param {string} phone_number - phone number
   * @param {string} password - Password
   * @returns {Promise<Object>} - Auth tokens and user data
   */
  async login(phone_number, password) {
    // Clear any previous state before login attempt
    this.clearState();
    
    const data = await this.fetch('token/', {
      method: 'POST',
      body: JSON.stringify({ phone_number, password }),
    });
    
    // Set tokens in memory and storage
    this._authToken = data.access;
    
    // Store the auth tokens - must await these operations
    await AsyncStorage.setItem('authToken', data.access);
    await AsyncStorage.setItem('refreshToken', data.refresh);
    
    // Fetch user profile after token is properly stored
    const user = await this.getCurrentUser();
    
    return {
      tokens: data,
      user,
    };
  }
  
  /**
   * Logout the current user
   */
  async logout() {
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('refreshToken');
    this.clearState();
  }
  
  /**
   * Change user's password
   * @param {string} oldPassword - Current password
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} - Success message
   */
  async changePassword(oldPassword, newPassword) {
    return this.fetch('users/change_password/', {
      method: 'POST',
      body: JSON.stringify({
        old_password: oldPassword,
        new_password: newPassword
      }),
    });
  }
  
  /**
   * Get the current user's profile
   * @returns {Promise<Object>} - User profile data
   */
  async getCurrentUser() {
    // Fetch fresh data from the server
    const userData = await this.fetch('users/me/');
    // Cache the user data
    this._userCache = userData;
    return userData;
  }
  
  /**
   * Refresh the auth token
   * @returns {Promise<Object>} - New auth tokens
   */
  async refreshToken() {
    const refreshToken = await AsyncStorage.getItem('refreshToken');
    
    if (!refreshToken) {
      throw new Error('No refresh token available');
    }
    
    const data = await this.fetch('token/refresh/', {
      method: 'POST',
      body: JSON.stringify({ refresh: refreshToken }),
    });
    
    // Store the new auth token
    await AsyncStorage.setItem('authToken', data.access);
    
    return data;
  }

  /**
   * Request a password reset code via SMS
   * @param {string} phoneNumber - Phone number associated with the account
   * @returns {Promise<Object>} - Response data
   */
  async requestPasswordReset(phoneNumber) {
    return this.fetch('users/request_password_reset/', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: phoneNumber
      })
    });
  }
  
  /**
   * Verify a password reset code
   * @param {string} phoneNumber - Phone number associated with the account
   * @param {string} code - The reset code received via SMS
   * @returns {Promise<Object>} - Response data
   */
  async verifyResetCode(phoneNumber, code) {
    return this.fetch('users/verify_reset_code/', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: phoneNumber,
        code: code
      })
    });
  }
  
  /**
   * Reset password with valid code
   * @param {string} phoneNumber - Phone number associated with the account
   * @param {string} code - The reset code received via SMS
   * @param {string} newPassword - New password to set
   * @returns {Promise<Object>} - Response data
   */
  async resetPassword(phoneNumber, code, newPassword) {
    return this.fetch('users/reset_password/', {
      method: 'POST',
      body: JSON.stringify({
        phone_number: phoneNumber,
        code: code,
        new_password: newPassword
      })
    });
  }

  // Shop methods
  
  /**
   * Get all shops with pagination support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters to apply
   * @returns {Promise<Object>} - Paginated list of shops
   */
  async getShops() {
    return this.fetch('shops/');
  }

  /**
   * Get a shop by ID
   * @param {number} id - Shop ID
   * @returns {Promise<Object>} - Shop data
   */
  async getShop(id) {
    return this.fetch(`shops/${id}/`);
  }
  
  /**
   * Get the user's assigned shop
   * @returns {Promise<Object>} - Shop data
   */
  async getUserShop() {
    return this.fetch('shops/assigned/');
  }
  
  // Stock methods
  
  /**
   * Get stock items with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id
   * @returns {Promise<Object>} - Paginated list of stock items
   */
  async getStockItems(page = 1, filters = {}) {
    return this.fetch('stock-items/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Get stock items that are low in inventory
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id
   * @returns {Promise<Object>} - Paginated list of low stock items
   */
  async getLowStockItems(page = 1, filters = {}) {
    return this.fetch('stock-items/low_stock/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Create a stock log entry
   * @param {Object} data - Stock log data
   * @returns {Promise<Object>} - Created stock log
   */
  async createStockLog(data) {
    return this.fetch('stock-logs/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  /**
   * Get stock logs with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id
   * @returns {Promise<Object>} - Paginated list of stock logs
   */
  async getStockLogs(page = 1, filters = {}) {
    return this.fetch('stock-logs/', {}, {
      page,
      ...filters
    });
  }
  
  // Customer methods
  
  /**
   * Get customers with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id and search query
   * @returns {Promise<Object>} - Paginated list of customers
   */
  async getCustomers(page = 1, filters = {}) {
    return this.fetch('customers/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Get a customer by ID
   * @param {number} id - Customer ID
   * @returns {Promise<Object>} - Customer data
   */
  async getCustomer(id) {
    return this.fetch(`customers/${id}/`);
  }
  
  /**
   * Create a new customer
   * @param {Object} data - Customer data
   * @returns {Promise<Object>} - Created customer
   */
  async createCustomer(data) {
    return this.fetch('customers/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  /**
   * Update a customer
   * @param {number} id - Customer ID
   * @param {Object} data - Customer data
   * @returns {Promise<Object>} - Updated customer
   */
  async updateCustomer(id, data) {
    return this.fetch(`customers/${id}/`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  }
  
  // Sales methods
  
  /**
   * Get sales with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id, start_date, end_date
   * @returns {Promise<Object>} - Paginated list of sales
   */
  async getSales(page = 1, filters = {}) {
    return this.fetch('sales/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Get a sale by ID
   * @param {number} id - Sale ID
   * @returns {Promise<Object>} - Sale data
   */
  async getSale(id) {
    return this.fetch(`sales/${id}/`);
  }
  
  /**
   * Create a new sale
   * @param {Object} data - Sale data
   * @returns {Promise<Object>} - Created sale
   */
  async createSale(data) {
    return this.fetch('sales/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
  
  // Refill methods
  
  /**
   * Get refills with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id, start_date, end_date
   * @returns {Promise<Object>} - Paginated list of refills
   */
  async getRefills(page = 1, filters = {}) {
    return this.fetch('refills/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Get a refill by ID
   * @param {number} id - Refill ID
   * @returns {Promise<Object>} - Refill data
   */
  async getRefill(id) {
    return this.fetch(`refills/${id}/`);
  }
  
  /**
   * Create a new refill
   * @param {Object} data - Refill data
   * @returns {Promise<Object>} - Created refill
   */
  async createRefill(data) {
    return this.fetch('refills/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Package methods
  
  /**
   * Get packages with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id
   * @returns {Promise<Object>} - Paginated list of packages
   */
  async getPackages(page = 1, filters = {}) {
    return this.fetch('packages/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Get a package by ID
   * @param {number} id - Package ID
   * @returns {Promise<Object>} - Package data
   */
  async getPackage(id) {
    return this.fetch(`packages/${id}/`);
  }

  // Meter reading methods
  
  /**
   * Get meter readings with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id, start_date, end_date
   * @returns {Promise<Object>} - Paginated list of meter readings
   */
  async getMeterReadings(page = 1, filters = {}) {
    return this.fetch('meter-readings/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Create a new meter reading
   * @param {FormData|Object} data - Meter reading data as FormData or plain object
   * @returns {Promise<Object>} - Created meter reading
   */
  async createMeterReading(data) {
    // Check if data is FormData
    if (data instanceof FormData) {
      // For FormData, we need to use different Content-Type and avoid JSON.stringify
      return this.fetch('meter-readings/', {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // For plain objects, use JSON as before
      return this.fetch('meter-readings/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  }

  // Expense methods
  
  /**
   * Get expenses with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id, start_date, end_date
   * @returns {Promise<Object>} - Paginated list of expenses
   */
  async getExpenses(page = 1, filters = {}) {
    return this.fetch('expenses/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Create a new expense
   * @param {FormData|Object} data - Expense data as FormData or plain object
   * @returns {Promise<Object>} - Created expense
   */
  async createExpense(data) {
    // Check if data is FormData
    if (data instanceof FormData) {
      // For FormData, we need to use different Content-Type and avoid JSON.stringify
      return this.fetch('expenses/', {
        method: 'POST',
        body: data,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      // For plain objects, use JSON as before
      return this.fetch('expenses/', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
  }

  // Credits methods
  
  /**
   * Get credits with pagination and filtering support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including shop_id, customer_id
   * @returns {Promise<Object>} - Paginated list of credits
   */
  async getCredits(page = 1, filters = {}) {
    return this.fetch('credits/', {}, {
      page,
      ...filters
    });
  }
  
  /**
   * Create a new credit
   * @param {Object} data - Credit data
   * @returns {Promise<Object>} - Created credit
   */
  async createCredit(data) {
    return this.fetch('credits/', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Dashboard methods
  
  /**
   * Get dashboard statistics
   * @param {Object} filters - Filters including shop_id, date_range
   * @returns {Promise<Object>} - Dashboard statistics
   */
  async getDashboardStats(filters = {}) {
    return this.fetch('dashboard/stats/', {}, filters);
  }
  
  /**
   * Get sales statistics over time
   * @param {Object} filters - Filters including shop_id, date_range, interval
   * @returns {Promise<Object>} - Sales statistics
   */
  async getSalesStats(filters = {}) {
    return this.fetch('dashboard/sales-stats/', {}, filters);
  }

  // SMS methods
  
  /**
   * Get SMS history with pagination support
   * @param {number} page - Page number (1-based)
   * @param {Object} filters - Filters including search
   * @returns {Promise<Object>} - Paginated list of SMS messages
   */
  async getSMSHistory(page = 1, filters = {}) {
    return this.fetch('sms/', {}, {
      page,
      ...filters
    });
  }

  /**
   * Send an SMS to a specific customer
   * @param {number} customerId - Customer ID 
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendSMSToCustomer(customerId, message) {
    return this.fetch('sms/send_to_customer/', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, message })
    });
  }

  /**
   * Send custom SMS to one or more recipients
   * @param {Array<string>} recipients - List of phone numbers
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendCustomSMS(recipients, message) {
    return this.fetch('sms/send_custom/', {
      method: 'POST',
      body: JSON.stringify({ recipients, message })
    });
  }

  /**
   * Send an SMS to all customers of a shop
   * @param {number} shopId - Shop ID
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendSMSToShopCustomers(shopId, message) {
    return this.fetch('sms/send_to_shop_customers/', {
      method: 'POST',
      body: JSON.stringify({ shop_id: shopId, message })
    });
  }

  /**
   * Send an SMS to all customers with credits
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendSMSToCreditCustomers(message) {
    return this.fetch('sms/send_to_credit_customers/', {
      method: 'POST',
      body: JSON.stringify({ message })
    });
  }

  /**
   * Send a free refill notification to a customer
   * @param {number} customerId - Customer ID
   * @param {boolean} isThankyou - If true, send a thank-you message, else notification
   * @returns {Promise<Object>} - Response data
   */
  async sendFreeRefillSMS(customerId, isThankyou = false) {
    return this.fetch('sms/send_free_refill_sms/', {
      method: 'POST',
      body: JSON.stringify({ customer_id: customerId, is_thankyou: isThankyou })
    });
  }

  /**
   * Send SMS to custom recipients (phone numbers entered manually)
   * @param {string} phoneNumbersText - Comma-separated phone numbers
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendSMSToCustomRecipients(phoneNumbersText, message) {
    // Parse the comma-separated phone numbers into an array
    const recipients = phoneNumbersText
      .split(',')
      .map(number => number.trim())
      .filter(number => number.length > 0);
    
    // Use the existing custom SMS method
    return this.sendCustomSMS(recipients, message);
  }

  /**
   * Send SMS to selected customers
   * @param {Array<Object>} customers - Array of customer objects
   * @param {string} message - The message to send
   * @returns {Promise<Object>} - Response data
   */
  async sendSMSToSelectedCustomers(customers, message) {
    // Extract phone numbers from customer objects
    const recipients = customers
      .map(customer => customer.phone_number)
      .filter(phone => phone && phone.trim().length > 0);
    
    // Use the existing custom SMS method
    return this.sendCustomSMS(recipients, message);
  }
}

export default new Api();