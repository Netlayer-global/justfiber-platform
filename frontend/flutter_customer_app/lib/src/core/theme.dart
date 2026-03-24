import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFF121212);
  const surface = Color(0xFF181818);
  const surfaceAlt = Color(0xFF202020);
  const primary = Color(0xFF8224E3);
  const accent = Color(0xFF8224E3);
  const tertiary = Color(0xFF8224E3);
  const text = Color(0xFFF7F7F8);
  const muted = Color(0xFFA1A1AA);
  const cardSurface = Color(0xFF1B1B1D);
  const cardText = Color(0xFFF7F7F8);
  final base = ThemeData.light(useMaterial3: true);
  final textTheme = GoogleFonts.spaceGroteskTextTheme(base.textTheme).copyWith(
    headlineMedium: GoogleFonts.spaceGrotesk(fontSize: 30, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.8),
    headlineSmall: GoogleFonts.spaceGrotesk(fontSize: 24, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.6),
    titleLarge: GoogleFonts.spaceGrotesk(fontSize: 20, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.4),
    titleMedium: GoogleFonts.spaceGrotesk(fontSize: 16, fontWeight: FontWeight.w700, color: text),
    bodyLarge: GoogleFonts.dmSans(fontSize: 16, color: muted, height: 1.45),
    bodyMedium: GoogleFonts.dmSans(fontSize: 14, color: muted, height: 1.45),
    labelLarge: GoogleFonts.dmSans(fontSize: 14, fontWeight: FontWeight.w700, color: text),
    labelMedium: GoogleFonts.dmSans(fontSize: 12, fontWeight: FontWeight.w700, color: muted, letterSpacing: 0.2),
  );

  return ThemeData(
    colorScheme: const ColorScheme.dark(
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
      titleTextStyle: GoogleFonts.spaceGrotesk(fontSize: 22, fontWeight: FontWeight.w700, color: text, letterSpacing: -0.5),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      labelStyle: GoogleFonts.dmSans(color: muted, fontWeight: FontWeight.w600),
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
      hintStyle: GoogleFonts.dmSans(color: muted),
    ),
    cardTheme: CardThemeData(
      color: cardSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: const Color(0xFF161617),
      selectedItemColor: accent,
      unselectedItemColor: muted,
      selectedLabelStyle: GoogleFonts.dmSans(fontWeight: FontWeight.w700),
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: primary,
        foregroundColor: const Color(0xFFEFEEE8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700, fontSize: 15),
        elevation: 0,
        shadowColor: const Color(0x338224E3),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFF1E1E20),
        side: const BorderSide(color: Color(0x998224E3), width: 1.2),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 18),
        textStyle: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700, fontSize: 15),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: tertiary,
        textStyle: GoogleFonts.spaceGrotesk(fontWeight: FontWeight.w700),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: const Color(0xFF1E1E20),
      contentTextStyle: GoogleFonts.dmSans(color: text, fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: const Color(0x14F4F4F5),
    iconTheme: const IconThemeData(color: cardText),
  );
}
