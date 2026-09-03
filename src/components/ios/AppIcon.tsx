import React from 'react';
import { Platform, StyleProp, TextStyle, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { canUseSymbolView } from './nativeModuleSupport';

type AppIconProps = {
  iosName: string;
  ionicon: keyof typeof Ionicons.glyphMap;
  size?: number;
  color: string;
  style?: StyleProp<ViewStyle | TextStyle>;
};

export default function AppIcon({
  iosName,
  ionicon,
  size = 18,
  color,
  style,
}: AppIconProps) {
  if (Platform.OS === 'ios' && canUseSymbolView) {
    const { SymbolView } = require('expo-symbols') as typeof import('expo-symbols');
    return (
      <SymbolView
        name={iosName as any}
        size={size}
        tintColor={color}
        style={style as StyleProp<ViewStyle>}
        resizeMode="scaleAspectFit"
      />
    );
  }

  return <Ionicons name={ionicon} size={size} color={color} style={style as StyleProp<TextStyle>} />;
}
