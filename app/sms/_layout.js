import { Stack } from 'expo-router';

export default function SMSLayout() {
  return (
    <Stack>
      <Stack.Screen 
        name="bulk" 
        options={{ 
          title: "Bulk SMS",
          headerTitleAlign: 'center'
        }} 
      />
      <Stack.Screen 
        name="history" 
        options={{ 
          title: "SMS History",
          headerTitleAlign: 'center'
        }} 
      />
    </Stack>
  );
}