import { ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Redirect, Stack, SplashScreen } from 'expo-router';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { AuthProvider, useAuth } from '../services/AuthContext';
import { Text, View, ActivityIndicator, StatusBar } from 'react-native';
import { PaperProvider, MD3LightTheme as DefaultTheme } from 'react-native-paper';
import Toast from '../components/Toast';
import '../services/EventEmitter'; // Import to initialize event emitter

// Define ocean blue theme colors
const oceanBlueTheme = {
  dark: false,
  colors: {
    primary: '#0077B6', // Dark Ocean Blue
    secondary: '#48CAE4', // Light Ocean Blue
    background: '#FFFFFF',
    card: '#F8F9FA',
    text: '#333333',
    border: '#CAF0F8',
    notification: '#0096C7',
    accent: '#00B4D8',
    statusBar: '#0077B6', // Status bar color
  },
  // Add font configuration to theme
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    light: {
      fontFamily: 'System',
      fontWeight: '300',
    },
    thin: {
      fontFamily: 'System',
      fontWeight: '100',
    },
  },
};

// Create a custom Paper theme that matches our app colors
const paperTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: oceanBlueTheme.colors.primary,
    accent: oceanBlueTheme.colors.accent,
    background: oceanBlueTheme.colors.background,
    surface: oceanBlueTheme.colors.card,
    text: oceanBlueTheme.colors.text,
  },
};

// Main layout wrapper component with authentication logic
function RootLayoutNav() {
  const { user, loading, initialized, isAuthenticated } = useAuth();
  
  console.log('Auth state:', { user: !!user, loading, initialized, isAuthenticated });
  
  // Show loading indicator while authentication is being checked
  if (loading || !initialized) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <StatusBar 
          backgroundColor={oceanBlueTheme.colors.statusBar}
          barStyle="light-content" 
        />
        <ActivityIndicator size="large" color="#0077B6" />
        <Text style={{ marginTop: 20, color: '#333333' }}>Loading...</Text>
      </View>
    );
  }

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={oceanBlueTheme}>
        <StatusBar 
          backgroundColor={oceanBlueTheme.colors.statusBar}
          barStyle="light-content" 
        />
        <Stack screenOptions={{ headerShown: false }}>
          {!isAuthenticated ? (
            // Show login when not authenticated
            <Stack.Screen name="login" />
          ) : (
            // Show tabs when authenticated
            <Stack.Screen name="(tabs)" />
          )}
          <Stack.Screen name="+not-found" options={{ title: 'Not Found' }} />
        </Stack>
        
        {/* Toast notification for session-related messages */}
        <Toast />
      </ThemeProvider>
    </PaperProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    'SpaceMono-Regular': require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      // Hide the splash screen once fonts are loaded or if there's an error
      SplashScreen.hideAsync().catch(() => {
        // Ignore errors from hideAsync
        console.log('Error hiding splash screen');
      });
    }
  }, [fontsLoaded, fontError]);

  // Before the fonts are loaded, return a loading view
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <Text>Loading fonts...</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}