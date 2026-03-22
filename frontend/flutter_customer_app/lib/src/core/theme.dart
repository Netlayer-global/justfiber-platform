import 'package:flutter/material.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFFF7F9FC);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF1F5F9);
  const primary = Color(0xFF0B0F19);
  const accent = Color(0xFF00F5D4);
  const tertiary = Color(0xFF00C2FF);
  const text = Color(0xFF05070D);
  const muted = Color(0xFF64748B);

  return ThemeData(
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      tertiary: tertiary,
      error: Color(0xFFDC2626),
      background: background,
      surface: surface,
      onSurface: text,
      onPrimary: Colors.white,
      onSecondary: Color(0xFF031B17),
      onBackground: text,
    ),
    scaffoldBackgroundColor: background,
    useMaterial3: true,
    textTheme: const TextTheme(
      headlineMedium: TextStyle(fontSize: 30, fontWeight: FontWeight.w800, color: text),
      headlineSmall: TextStyle(fontSize: 24, fontWeight: FontWeight.w800, color: text),
      titleLarge: TextStyle(fontSize: 20, fontWeight: FontWeight.w700, color: text),
      titleMedium: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: text),
      bodyMedium: TextStyle(fontSize: 14, color: muted, height: 1.45),
      labelMedium: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: muted),
    ),
    appBarTheme: const AppBarTheme(
      backgroundColor: background,
      foregroundColor: text,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: text),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: Color(0xFFE5E7EB)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: accent, width: 1.4),
      ),
      hintStyle: const TextStyle(color: muted),
    ),
    cardTheme: CardThemeData(
      color: surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: Color(0xFF0B0F19),
      selectedItemColor: accent,
      unselectedItemColor: muted,
      selectedLabelStyle: TextStyle(fontWeight: FontWeight.w700),
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: text,
        side: const BorderSide(color: Color(0xFFCBD5E1)),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: tertiary,
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: primary,
      contentTextStyle: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      behavior: SnackBarBehavior.floating,
    ),
  );
}
