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
    final resolvedBackground = color ?? const Color(0xFF1B1B1D);
    final resolvedTextColor = textColor ?? const Color(0xFFF7F7F8);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(color: Color(0x46000000), blurRadius: 26, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x108224E3), blurRadius: 14, offset: Offset(0, 6)),
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
                  Color.alphaBlend(const Color(0x12FFFFFF), resolvedBackground),
                  Color.alphaBlend(const Color(0x0A8224E3), resolvedBackground),
                ],
              ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(
            color: borderColor ?? const Color(0x228224E3),
            width: 1,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -18,
              right: 18,
              child: Container(
                width: 72,
                height: 72,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x1A8224E3), Color(0x008224E3)],
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
