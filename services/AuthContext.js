import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SplashScreen from 'expo-splash-screen';
import { useRouter } from 'expo-router';
import api from './api';
import eventEmitter from './EventEmitter';

// Context to manage authentication state
const AuthContext = createContext();

// Custom hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider component that wraps the app
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  
  // Listen for session expiration events
  useEffect(() => {
    const sessionExpiredListener = eventEmitter.on('sessionExpired', handleSessionExpired);
    
    return () => {
      sessionExpiredListener(); // Clean up listener
    };
  }, []);
  
  // Handle session expiration - navigate to login page
  const handleSessionExpired = (message) => {
    // Clear any stored tokens
    clearTokens();
    // Redirect to login screen after a short delay (to allow the toast to be seen)
    setTimeout(() => {
      if (router) {
        router.replace('/(auth)/login');
      }
    }, 1500);
  };
  
  // Helper to clear tokens
  const clearTokens = async () => {
    try {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('refreshToken');
      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
      api.clearState();
    } catch (e) {
      console.error('Error clearing tokens:', e);
    }
  };
  
  // Check for stored tokens on mount
  useEffect(() => {
    const loadTokens = async () => {
      try {
        // Check for stored token
        const token = await AsyncStorage.getItem('authToken');
        const refreshToken = await AsyncStorage.getItem('refreshToken');

        if (token) {
          setAuthToken(token);
          // Set up API with the token
          api.setAuthToken(token);
          
          try {
            // Fetch user profile
            const userData = await api.getCurrentUser();
            setUser(userData);
            setIsAuthenticated(true);
          } catch (profileError) {
            console.error('Failed to load user profile:', profileError);
            // Clear token if profile fetch fails
            await clearTokens();
            // Inform the user with a friendly message
            eventEmitter.emit('toast:error', 'Your session has expired. Please log in again.');
          }
        } else {
          setIsAuthenticated(false);
          api.clearState(); // Clear API state to ensure clean slate
        }
      } catch (e) {
        console.error('Failed to load auth tokens:', e);
        // If token is invalid/expired, clear it
        await clearTokens();
        eventEmitter.emit('toast:error', 'Authentication error. Please log in again.');
      } finally {
        setLoading(false);
        setInitialized(true);
      }
    };
    
    loadTokens();
  }, []);

  // Login handler
  const login = async (username, password) => {
    try {
      setError(null);
      
      // Reset state before login to clear any previously logged in user data
      setUser(null);
      setAuthToken(null);
      
      const response = await api.login(username, password);
      
      // Store tokens
      await AsyncStorage.setItem('authToken', response.tokens.access);
      if (response.tokens.refresh) {
        await AsyncStorage.setItem('refreshToken', response.tokens.refresh);
      }
      
      // Update state
      setAuthToken(response.tokens.access);
      setUser(response.user);
      setIsAuthenticated(true);
      
      // Set up API with the new token
      api.setAuthToken(response.tokens.access);
      
      // Show welcome message
      eventEmitter.emit('toast:success', `Welcome, ${response.user.names}`);
      
      return response;
    } catch (e) {
      setError(e.message || 'Failed to login');
      // Show error message to user
      eventEmitter.emit('toast:error', e.message || 'Login failed. Please check your credentials.');
      throw e;
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      console.error('Failed to logout from server:', e);
    } finally {
      // Always clear local state regardless of server response
      await clearTokens();
      
      // Show logout message
      eventEmitter.emit('toast:info', 'You have been logged out');
    }
  };

  // Check if user is a director
  const isDirector = () => {
    return user?.user_class === 'Director';
  };

  // Value provided to consumers of this context
  const value = {
    user,
    setUser,
    authToken,
    loading,
    error,
    login,
    logout,
    isDirector,
    initialized,
    isAuthenticated
  };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        console.log('AuthContext: Rendering loading state') || null
      ) : (
        console.log('AuthContext: Rendering children') || children
      )}
    </AuthContext.Provider>
  );
};

export default AuthContext;