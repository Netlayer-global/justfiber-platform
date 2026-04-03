import 'package:flutter/material.dart';

ThemeData buildInstallerTheme() {
  const background = Color(0xFFF7F8FC);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF0F4FA);
  const primary = Color(0xFF8126CF);
  const accent = Color(0xFF4D9FFF);
  const text = Color(0xFF213042);
  const muted = Color(0xFF718096);

  return ThemeData(
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      surface: surface,
      onSurface: text,
    ),
    useMaterial3: true,
    scaffoldBackgroundColor: background,
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontSize: 36, fontWeight: FontWeight.w800, color: text),
      headlineMedium: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: text),
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: text),
      titleLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: text),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: text),
      bodyMedium: TextStyle(fontSize: 13, color: muted, height: 1.45),
      labelMedium: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.4),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: primary, width: 1.2),
      ),
      hintStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: primary,
      unselectedItemColor: muted,
      showUnselectedLabels: false,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
  );
}
