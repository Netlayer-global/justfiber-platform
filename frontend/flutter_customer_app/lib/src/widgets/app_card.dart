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
    final resolvedTextColor = textColor ?? const Color(0xFF131313);
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(color: Color(0x18000000), blurRadius: 30, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x08FFFFFF), blurRadius: 8, offset: Offset(0, -2)),
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
                  Color.alphaBlend(const Color(0x048224E3), resolvedBackground),
                ],
              ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(
            color: borderColor ?? const Color(0x12B9B2AA),
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
                    colors: [Color(0x0F8224E3), Color(0x008224E3)],
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
