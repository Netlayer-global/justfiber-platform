import 'package:flutter/material.dart';

ThemeData buildInstallerTheme() {
  const background = Color(0xFF121212);
  const surface = Color(0xFF181818);
  const surfaceAlt = Color(0xFF202020);
  const primary = Color(0xFF8224E3);
  const accent = Color(0xFF8224E3);
  const text = Color(0xFFF7F7F8);
  const muted = Color(0xFFA1A1AA);

  return ThemeData(
    colorScheme: const ColorScheme.dark(
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
        foregroundColor: text,
        backgroundColor: const Color(0xFF1E1E20),
        side: const BorderSide(color: Color(0x668224E3)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      ),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: background,
      selectedItemColor: primary,
      unselectedItemColor: muted,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
  );
}
