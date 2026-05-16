import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  JustFiber Design System — see /design-system/MASTER.md
//  Discipline: ONE accent (purple), translucent white surfaces, big typography.
// ─────────────────────────────────────────────────────────────────────────────

// Surfaces
const kBg = Color(0xFF000000); // pure black canvas
const kSurface = Color(0x1AFFFFFF); // 10% white — default card
const kSurfaceHigh = Color(0x14FFFFFF); // 8% white — elevated overlays
const kSurfaceLow = Color(0x0AFFFFFF); // 4% white — inputs, recessed wells
const kBorderSoft = Color(0x14FFFFFF); // 8% white — card borders
const kBorderHard = Color(0x33FFFFFF); // 20% white — focused borders
const kDivider = Color(0x0AFFFFFF);

// Single accent — JustFiber purple. Never add a second accent.
const kAccent = Color(0xFF8224E3);
const kAccentDeep = Color(0xFF5B10A0); // gradient end (only for hero)
const kAccentSoft = Color(0x338224E3); // 20% purple tint

// Backwards-compatible aliases (kept so existing imports don't break)
const kPrimary = kAccent;
const kPrimaryLight = Color(0xFFD8B4FE);
const kAccentCyan = kAccent; // collapsed: no second accent
const kSurface2 = kSurfaceHigh;
const kBorder = kBorderSoft;

// Text — pure white at controlled opacities (NO gray hex codes anywhere)
const kText = Color(0xFFFFFFFF);
const kTextDim = Color(0xCCFFFFFF); // 80%
const kTextMuted = Color(0x80FFFFFF); // 50%
const kTextFaint = Color(0x4DFFFFFF); // 30%

// Backwards-compatible alias
const kMuted = kTextMuted;

// Status (used sparingly — only true status meaning)
const kSuccess = Color(0xFF34D399);
const kDanger = Color(0xFFEF4444);

// Radius family — see MASTER.md §5
const kRCard = 28.0;
const kRSurface = 20.0;
const kRButton = 18.0;
const kRSmall = 14.0;
const kRPill = 999.0;

ThemeData buildJustFiberTheme() {
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: Colors.black,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  final baseText = GoogleFonts.interTextTheme(ThemeData.dark().textTheme);

  return ThemeData(
    brightness: Brightness.dark,
    colorScheme: const ColorScheme.dark(
      primary: kAccent,
      secondary: kAccent, // collapsed — single accent rule
      surface: kSurface,
      onSurface: kText,
      onPrimary: kText,
    ),
    useMaterial3: true,
    scaffoldBackgroundColor: kBg,
    appBarTheme: AppBarTheme(
      backgroundColor: Colors.transparent,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      foregroundColor: kText,
      systemOverlayStyle: const SystemUiOverlayStyle(
        statusBarIconBrightness: Brightness.light,
      ),
      titleTextStyle: GoogleFonts.inter(
        fontSize: 17,
        fontWeight: FontWeight.w800,
        color: kText,
        letterSpacing: -0.3,
      ),
    ),
    cardColor: kSurface,
    textTheme: baseText.copyWith(
      // Display & headlines
      headlineLarge: GoogleFonts.inter(
          fontSize: 32,
          fontWeight: FontWeight.w800,
          color: kText,
          height: 1.1,
          letterSpacing: -0.8),
      headlineMedium: GoogleFonts.inter(
          fontSize: 24,
          fontWeight: FontWeight.w800,
          color: kText,
          height: 1.15,
          letterSpacing: -0.5),
      headlineSmall: GoogleFonts.inter(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: kText,
          letterSpacing: -0.3),
      titleLarge: GoogleFonts.inter(
          fontSize: 17, fontWeight: FontWeight.w700, color: kText),
      titleMedium: GoogleFonts.inter(
          fontSize: 15, fontWeight: FontWeight.w600, color: kText),
      bodyLarge:
          GoogleFonts.inter(fontSize: 15, color: kText, height: 1.55),
      bodyMedium:
          GoogleFonts.inter(fontSize: 14, color: kTextDim, height: 1.55),
      labelMedium: GoogleFonts.inter(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: kTextMuted,
          letterSpacing: 1.6),
      labelSmall: GoogleFonts.inter(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: kTextMuted,
          letterSpacing: 1.6),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurfaceLow,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRSmall),
        borderSide: const BorderSide(color: kBorderSoft),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRSmall),
        borderSide: const BorderSide(color: kBorderSoft),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(kRSmall),
        borderSide: const BorderSide(color: kAccent, width: 1.4),
      ),
      hintStyle: GoogleFonts.inter(color: kTextFaint, fontSize: 14),
      labelStyle: GoogleFonts.inter(color: kTextMuted, fontSize: 14),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kAccent,
        foregroundColor: kText,
        elevation: 0,
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kRButton)),
        textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.2),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kText,
        side: const BorderSide(color: kBorderSoft),
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(kRButton)),
        textStyle: GoogleFonts.inter(
            fontWeight: FontWeight.w700, fontSize: 14),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(
        foregroundColor: kAccent,
        textStyle:
            GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 13),
      ),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      backgroundColor: kSurface,
      contentTextStyle: GoogleFonts.inter(color: kText, fontSize: 13),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRSmall),
        side: const BorderSide(color: kBorderSoft),
      ),
    ),
    bottomNavigationBarTheme: BottomNavigationBarThemeData(
      backgroundColor: kBg,
      selectedItemColor: kAccent,
      unselectedItemColor: kTextMuted,
      showUnselectedLabels: true,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
      selectedLabelStyle:
          GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w800),
      unselectedLabelStyle:
          GoogleFonts.inter(fontSize: 10, fontWeight: FontWeight.w600),
    ),
    dividerColor: kDivider,
    dividerTheme: const DividerThemeData(
        color: kDivider, thickness: 1, space: 1),
    dialogTheme: DialogThemeData(
      backgroundColor: const Color(0xFF0A0A14),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRCard)),
    ),
    bottomSheetTheme: const BottomSheetThemeData(
      backgroundColor: Color(0xFF0A0A14),
      modalBackgroundColor: Color(0xFF0A0A14),
    ),
    popupMenuTheme: PopupMenuThemeData(
      color: const Color(0xFF0A0A14),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(kRSmall),
        side: const BorderSide(color: kBorderSoft),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: kSurface,
      labelStyle: GoogleFonts.inter(
          fontSize: 12, fontWeight: FontWeight.w700, color: kText),
      side: const BorderSide(color: kBorderSoft),
      shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(kRPill)),
    ),
  );
}
