import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFFF6F1EB);
  const surface = Color(0xFFFFFFFF);
  const surfaceAlt = Color(0xFFF2ECE6);
  const primary = Color(0xFF8224E3);
  const accent = Color(0xFF8224E3);
  const tertiary = Color(0xFF8224E3);
  const text = Color(0xFF131313);
  const muted = Color(0xFF6E6A67);
  const cardSurface = Color(0xFFFFFFFF);
  const cardText = Color(0xFF131313);
  final base = ThemeData.light(useMaterial3: true);
  final textTheme = GoogleFonts.openSansTextTheme(base.textTheme).copyWith(
    headlineMedium: GoogleFonts.openSans(fontSize: 30, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.6),
    headlineSmall: GoogleFonts.openSans(fontSize: 24, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.4),
    titleLarge: GoogleFonts.openSans(fontSize: 20, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.2),
    titleMedium: GoogleFonts.openSans(fontSize: 16, fontWeight: FontWeight.w700, color: text),
    bodyLarge: GoogleFonts.openSans(fontSize: 16, color: muted, height: 1.45),
    bodyMedium: GoogleFonts.openSans(fontSize: 14, color: muted, height: 1.45),
    labelLarge: GoogleFonts.openSans(fontSize: 14, fontWeight: FontWeight.w700, color: text),
    labelMedium: GoogleFonts.openSans(fontSize: 12, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.2),
  );

  return ThemeData(
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      tertiary: tertiary,
      error: Color(0xFFDC2626),
      background: background,
      surface: surface,
      onSurface: text,
      onPrimary: Color(0xFFEFEEE8),
      onSecondary: Color(0xFFEFEEE8),
      onBackground: text,
    ),
    scaffoldBackgroundColor: background,
    useMaterial3: true,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: text,
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.openSans(fontSize: 22, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.3),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      labelStyle: GoogleFonts.openSans(color: muted, fontWeight: FontWeight.w600),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: Color(0x338224E3)),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: Color(0x338224E3)),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(20),
        borderSide: const BorderSide(color: accent, width: 1.4),
      ),
      hintStyle: GoogleFonts.openSans(color: muted),
    ),
    cardTheme: CardThemeData(
      color: cardSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: const Color(0xFFFFFFFF),
      selectedItemColor: accent,
      unselectedItemColor: muted,
      selectedLabelStyle: GoogleFonts.openSans(fontWeight: FontWeight.w700),
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: const Color(0xFFEFEEE8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: GoogleFonts.openSans(fontWeight: FontWeight.w700, fontSize: 15),
        elevation: 0,
        shadowColor: const Color(0x338224E3),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFFFFFFFF),
        side: const BorderSide(color: Color(0x998224E3), width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: GoogleFonts.openSans(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: tertiary,
        textStyle: GoogleFonts.openSans(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: const Color(0xFFFFFFFF),
      contentTextStyle: GoogleFonts.openSans(color: text, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: const Color(0x14000000),
    iconTheme: const IconThemeData(color: cardText),
  );
}
