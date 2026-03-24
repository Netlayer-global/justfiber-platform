import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

ThemeData buildJustFiberTheme() {
  const background = Color(0xFF0C1018);
  const surface = Color(0xFF0C1018);
  const surfaceAlt = Color(0xFF12161A);
  const primary = Color(0xFF8224E3);
  const accent = Color(0xFF8224E3);
  const tertiary = Color(0xFF8224E3);
  const text = Color(0xFFF5F5F5);
  const muted = Color(0xFF8A92A3);
  const cardSurface = Color(0xFF15181C);
  const cardText = Color(0xFFF5F5F5);
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
    colorScheme: const ColorScheme.light(
      primary: primary,
      secondary: accent,
      tertiary: tertiary,
      error: Color(0xFFDC2626),
      background: background,
      surface: surface,
      onSurface: const Color(0xFFF5F5F5),
      onPrimary: Color(0xFFEFEEE8),
      onSecondary: Color(0xFFEFEEE8),
      onBackground: const Color(0xFFF5F5F5),
    ),
    scaffoldBackgroundColor: background,
    useMaterial3: true,
    textTheme: textTheme,
    appBarTheme: AppBarTheme(
      backgroundColor: background,
      foregroundColor: const Color(0xFFF5F5F5),
      elevation: 0,
      scrolledUnderElevation: 0,
      centerTitle: true,
      titleTextStyle: GoogleFonts.spaceGrotesk(fontSize: 22, fontWeight: FontWeight.w700, color: const Color(0xFFF5F5F5), letterSpacing: -0.5),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: surfaceAlt,
      labelStyle: GoogleFonts.dmSans(color: const Color(0xFF9CA3AF), fontWeight: FontWeight.w600),
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
      hintStyle: GoogleFonts.dmSans(color: const Color(0xFF7C8492)),
    ),
    cardTheme: CardThemeData(
      color: cardSurface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: const Color(0xFF0C1018),
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
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: const Color(0xFF8224E3),
        backgroundColor: const Color(0xFF111418),
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
      backgroundColor: const Color(0xFF12161A),
      contentTextStyle: GoogleFonts.dmSans(color: const Color(0xFFEFEEE8), fontWeight: FontWeight.w600),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
      behavior: SnackBarBehavior.floating,
    ),
    dividerColor: const Color(0x14FFFFFF),
    iconTheme: const IconThemeData(color: cardText),
  );
}

