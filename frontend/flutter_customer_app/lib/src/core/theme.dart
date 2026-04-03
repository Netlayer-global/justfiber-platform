import 'package:flutter/material.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFFF5F7FB);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF0F4FA);
  const primary = Color(0xFF0F4C81);
  const accent = Color(0xFF1D9BF0);
  const tertiary = Color(0xFF14B8A6);
  const text = Color(0xFF142033);
  const muted = Color(0xFF64748B);
  const outline = Color(0xFFD8E1EE);

  return ThemeData(
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      surface: surface,
      onSurface: text,
      tertiary: tertiary,
    ),
    useMaterial3: true,
    scaffoldBackgroundColor: background,
    appBarTheme: const AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: text,
    ),
    cardColor: surface,
    textTheme: const TextTheme(
      headlineLarge: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: text, height: 1.02),
      headlineMedium: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: text, height: 1.04),
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: text),
      titleLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: text),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: text),
      bodyLarge: TextStyle(fontSize: 15, color: text),
      bodyMedium: TextStyle(fontSize: 13, color: muted, height: 1.45),
      labelMedium: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.8),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: const BorderSide(color: outline),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: const BorderSide(color: outline),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(22),
        borderSide: const BorderSide(color: primary, width: 1.2),
      ),
      hintStyle: const TextStyle(color: muted),
      labelStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        side: const BorderSide(color: outline),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 15),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Color(0xFF142033),
      contentTextStyle: TextStyle(color: Colors.white),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Colors.white,
      selectedItemColor: primary,
      unselectedItemColor: muted,
      showUnselectedLabels: false,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    dividerColor: outline,
  );
}
