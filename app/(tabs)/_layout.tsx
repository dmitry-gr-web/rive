import { MissingIcon } from '@react-navigation/elements';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: 'Red',
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Talk',
          tabBarIcon: ({ color, size }) => <MissingIcon color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
