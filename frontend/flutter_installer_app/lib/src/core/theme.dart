import 'package:flutter/material.dart';

ThemeData buildInstallerTheme() {
  const background = Color(0xFFF6F1EB);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF2ECE6);
  const primary = Color(0xFF8224E3);
  const accent = Color(0xFF8224E3);
  const text = Color(0xFF131313);
  const muted = Color(0xFF6E6A67);

  return ThemeData(
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      background: background,
      surface: surface,
      onSurface: text,
      onBackground: text,
    ),
    scaffoldBackgroundColor: background,
    useMaterial3: true,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: text),
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: text),
      titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w700, color: text),
      titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w700, color: text),
      bodyMedium: TextStyle(fontSize: 13, color: muted),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
      labelSmall: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: muted),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: background,
      foregroundColor: text,
      elevation: 0,
      centerTitle: true,
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0x338224E3)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: Color(0x338224E3)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: primary, width: 1.2),
      ),
      labelStyle: const TextStyle(color: muted),
      hintStyle: const TextStyle(color: muted),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: const Color(0xFFEFEEE8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        elevation: 0,
        shadowColor: const Color(0x338224E3),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: primary,
        backgroundColor: const Color(0xFFFFFFFF),
        side: const BorderSide(color: Color(0x668224E3)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFFFFFFFF),
      selectedItemColor: primary,
      unselectedItemColor: muted,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
  );
}
