import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// JustFiber Premium Light Theme — Bright, Colorful, Modern
// Palette
const kBg = Color(0xFFF5F5FA); // light grey-purple background
const kSurface = Color(0xFFFFFFFF); // white cards
const kSurface2 = Color(0xFFF0EEFF); // elevated card (light purple tint)
const kPrimary = Color(0xFF8224E3); // brand purple
const kPrimaryLight = Color(0xFFB06AFF); // lighter purple
const kAccentCyan = Color(0xFF0EA5E9); // network accent blue
const kText = Color(0xFF1A1A2E); // dark text
const kMuted = Color(0xFF6B7280); // grey secondary text
const kBorder = Color(0xFFE5E7EB); // light grey border
const kDivider = Color(0xFFE5E7EB);

ThemeData buildJustFiberTheme() {
  // System chrome — light status bar
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
    systemNavigationBarColor: Colors.white,
    systemNavigationBarIconBrightness: Brightness.dark,
  ));

  final baseText = GoogleFonts.interTextTheme(ThemeData.light().textTheme);

  return ThemeData(
    brightness: Brightness.light,
    colorScheme: const ColorScheme.light(
      primary: kPrimary,
      secondary: kAccentCyan,
      surface: kSurface,
      onSurface: kText,
      onPrimary: Colors.white,
    ),
    useMaterial3: true,
    scaffoldBackgroundColor: kBg,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: kText,
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarIconBrightness: Brightness.dark,
      ),
      titleTextStyle: GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w700,
        color: kText,
      ),
    ),
    cardColor: kSurface,
    textTheme: baseText.copyWith(
      headlineLarge: GoogleFonts.inter(fontSize: 36, fontWeight: FontWeight.w800, color: kText, height: 1.05, letterSpacing: -1.2),
      headlineMedium: GoogleFonts.inter(fontSize: 28, fontWeight: FontWeight.w800, color: kText, height: 1.1, letterSpacing: -0.8),
      headlineSmall: GoogleFonts.inter(fontSize: 22, fontWeight: FontWeight.w700, color: kText, letterSpacing: -0.5),
      titleLarge: GoogleFonts.inter(fontSize: 17, fontWeight: FontWeight.w700, color: kText),
      titleMedium: GoogleFonts.inter(fontSize: 15, fontWeight: FontWeight.w600, color: kText),
      bodyLarge: GoogleFonts.inter(fontSize: 15, color: kText, height: 1.6),
      bodyMedium: GoogleFonts.inter(fontSize: 13, color: kMuted, height: 1.55),
      labelMedium: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700, color: kMuted, letterSpacing: 1.2),
      labelSmall: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w700, color: kMuted, letterSpacing: 1.5),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(16),
        borderSide: const BorderSide(color: kPrimary, width: 1.5),
      ),
      hintStyle: GoogleFonts.inter(color: kMuted, fontSize: 14),
      labelStyle: GoogleFonts.inter(color: kMuted, fontSize: 14),
      contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: Colors.white,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 14, letterSpacing: -0.2),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kPrimary,
        side: const BorderSide(color: kBorder),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 14),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: kPrimary,
        textStyle: GoogleFonts.inter(fontWeight: FontWeight.w600, fontSize: 13),
      ),
    ),
    dropdownMenuTheme: DropdownMenuThemeData(
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: kSurface,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: kBorder)),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: kText,
      contentTextStyle: GoogleFonts.inter(color: Colors.white, fontSize: 13),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: kSurface,
      selectedItemColor: kPrimary,
      unselectedItemColor: kMuted,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w700),
      unselectedLabelStyle: GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600),
    ),
    dividerColor: kDivider,
    dividerTheme: const DividerThemeData(color: kDivider, thickness: 1, space: 1),
    dialogTheme: DialogThemeData(
      backgroundColor: kSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: kSurface,
      modalBackgroundColor: kSurface,
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: kSurface,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: const BorderSide(color: kBorder)),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: kSurface2,
      labelStyle: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w600, color: kText),
      side: const BorderSide(color: kBorder),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
  );
}
