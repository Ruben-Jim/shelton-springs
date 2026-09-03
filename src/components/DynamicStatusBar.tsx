import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { getStatusBarStyleForRoute } from '../navigation/statusBarStyle';

type DynamicStatusBarProps = {
  routeName: string;
};

export default function DynamicStatusBar({ routeName }: DynamicStatusBarProps) {
  const style = getStatusBarStyleForRoute(routeName);
  return <StatusBar style={style} />;
}
