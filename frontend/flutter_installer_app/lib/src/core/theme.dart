import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

const kBg = Color(0xFF000000);
const kSurface = Color(0xFF0C0C18);
const kSurface2 = Color(0xFF111120);
const kSurface3 = Color(0xFF17172A);
const kPrimary = Color(0xFFA855F7);
const kPrimaryDark = Color(0xFF6D28D9);
const kPrimaryLight = Color(0xFFD8B4FE);
const kAccentCyan = Color(0xFF22D3EE);
const kText = Color(0xFFFFFFFF);
const kMuted = Color(0xFFB8ACCC);
const kSubtle = Color(0xFF7C728C);
const kBorder = Color(0x1FFFFFFF);
const kDivider = Color(0x0AFFFFFF);

const kInstallerGradient = LinearGradient(
  begin: Alignment.topLeft,
  end: Alignment.bottomRight,
  colors: [Color(0xFF3B0A73), Color(0xFF8B1CF6)],
);

ThemeData buildInstallerTheme() {
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: kBg,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  return ThemeData(
    colorScheme: const ColorScheme.dark(
      primary: kPrimary,
      secondary: kAccentCyan,
      surface: kSurface,
      onSurface: kText,
    ),
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: kBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: kBg,
      foregroundColor: kText,
      elevation: 0,
      centerTitle: false,
      surfaceTintColor: Colors.transparent,
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
          fontSize: 36,
          fontWeight: FontWeight.w900,
          color: kText,
          letterSpacing: -1.2),
      headlineMedium: TextStyle(
          fontSize: 30,
          fontWeight: FontWeight.w900,
          color: kText,
          letterSpacing: -0.8),
      headlineSmall: TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.w800,
          color: kText,
          letterSpacing: -0.4),
      titleLarge:
          TextStyle(fontSize: 19, fontWeight: FontWeight.w800, color: kText),
      titleMedium:
          TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: kText),
      bodyMedium: TextStyle(fontSize: 13, color: kMuted, height: 1.45),
      bodySmall: TextStyle(fontSize: 12, color: kSubtle, height: 1.4),
      labelSmall: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w800,
          color: kSubtle,
          letterSpacing: 1.8),
      labelMedium: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w800,
          color: kMuted,
          letterSpacing: 0.8),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: kSurface2,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: kBorder),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: kBorder),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(24),
        borderSide: const BorderSide(color: kPrimary, width: 1.2),
      ),
      labelStyle: const TextStyle(color: kMuted),
      hintStyle: const TextStyle(color: kSubtle),
      prefixIconColor: kPrimaryLight,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        backgroundColor: kPrimary,
        foregroundColor: kText,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 16),
        textStyle: const TextStyle(fontWeight: FontWeight.w700),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: kPrimaryLight,
        side: const BorderSide(color: kBorder),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 14),
      ),
    ),
    chipTheme: ChipThemeData(
      backgroundColor: kSurface2,
      selectedColor: kPrimary.withValues(alpha: 0.22),
      disabledColor: kSurface,
      labelStyle: const TextStyle(color: kMuted, fontWeight: FontWeight.w700),
      secondaryLabelStyle:
          const TextStyle(color: kText, fontWeight: FontWeight.w800),
      side: const BorderSide(color: kBorder),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(999)),
    ),
    bottomNavigationBarTheme: const BottomNavigationBarThemeData(
      backgroundColor: kSurface,
      selectedItemColor: kPrimaryLight,
      unselectedItemColor: kSubtle,
      showUnselectedLabels: false,
      type: BottomNavigationBarType.fixed,
      elevation: 0,
    ),
    snackBarTheme: SnackBarThemeData(
      backgroundColor: kSurface2,
      contentTextStyle: const TextStyle(color: kText),
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
  );
}
