import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
    this.textColor,
    this.padding = const EdgeInsets.all(20),
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final Color? textColor;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final resolvedBackground = color ?? const Color(0xFFFFFFFF);
    final resolvedTextColor = textColor ?? const Color(0xFF111827);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(color: Color(0x1A0F172A), blurRadius: 34, offset: Offset(0, 20)),
          BoxShadow(color: Color(0x0D8224E3), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: gradient ??
              LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  resolvedBackground,
                  Color.alphaBlend(const Color(0x0C8224E3), resolvedBackground),
                ],
              ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(
            color: borderColor ?? const Color(0x268224E3),
            width: 1.1,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -32,
              right: -10,
              child: Container(
                width: 120,
                height: 120,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x268224E3), Color(0x008224E3)],
                  ),
                ),
              ),
            ),
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Container(
                height: 1,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(999),
                  gradient: const LinearGradient(
                    colors: [Color(0x66FFFFFF), Color(0x00FFFFFF)],
                  ),
                ),
              ),
            ),
            IconTheme(
              data: IconThemeData(color: resolvedTextColor),
              child: DefaultTextStyle.merge(
                style: TextStyle(color: resolvedTextColor),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
