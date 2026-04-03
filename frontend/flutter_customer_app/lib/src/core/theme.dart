import 'package:flutter/material.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFFF8F6FD);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF3EDFB);
  const primary = Color(0xFF8126CF);
  const accent = Color(0xFFA855F7);
  const tertiary = Color(0xFFA02D70);
  const text = Color(0xFF2D2F30);
  const muted = Color(0xFF6F7280);
  const outline = Color(0xFFE8DDF7);

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
      headlineLarge: TextStyle(fontSize: 38, fontWeight: FontWeight.w800, color: text, height: 1.05),
      headlineMedium: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: text, height: 1.05),
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: text),
      titleLarge: TextStyle(fontSize: 19, fontWeight: FontWeight.w700, color: text),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: text),
      bodyLarge: TextStyle(fontSize: 15, color: text),
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
      labelStyle: const TextStyle(color: muted),
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: const SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: Color(0xFF2D2F30),
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
