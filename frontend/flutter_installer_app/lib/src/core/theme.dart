import 'package:flutter/material.dart';

ThemeData buildInstallerTheme() {
  const background = Color(0xFF081018);
  const surface = Color(0xFF101B27);
  const surfaceAlt = Color(0xFF162434);
  const primary = Color(0xFF1FD2A8);
  const accent = Color(0xFF4D9FFF);
  const text = Color(0xFFF1F7FF);
  const muted = Color(0xFF96A8BC);

  return ThemeData(
    colorScheme: const ColorScheme.dark(
      primary: primary,
      secondary: accent,
      surface: surface,
      onSurface: text,
    ),
    scaffoldBackgroundColor: background,
    useMaterial3: true,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontSize: 28, fontWeight: FontWeight.w700, color: text),
      headlineSmall: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: text),
      titleLarge: TextStyle(fontSize: 18, fontWeight: FontWeight.w600, color: text),
      titleMedium: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: text),
      bodyMedium: TextStyle(fontSize: 13, color: muted),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: muted),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(18),
        borderSide: const BorderSide(color: primary, width: 1.2),
      ),
      hintStyle: const TextStyle(color: muted),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF0C141E),
      selectedItemColor: primary,
      unselectedItemColor: muted,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
  );
}
