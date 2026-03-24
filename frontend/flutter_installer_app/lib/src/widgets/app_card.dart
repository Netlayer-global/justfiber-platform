import 'package:flutter/material.dart';

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(30),
        boxShadow: const [
          BoxShadow(color: Color(0x180F172A), blurRadius: 28, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x108224E3), blurRadius: 18, offset: Offset(0, 8)),
        ],
      ),
      child: Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          gradient: gradient ??
              LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  color ?? const Color(0xFFFFFFFF),
                  Color.alphaBlend(const Color(0x0C8224E3), color ?? const Color(0xFFFFFFFF)),
                ],
              ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: borderColor ?? const Color(0x268224E3)),
        ),
        child: Stack(
          children: [
            Positioned(
              top: -28,
              right: -12,
              child: Container(
                width: 112,
                height: 112,
                decoration: const BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [Color(0x208224E3), Color(0x008224E3)],
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
            child,
          ],
        ),
      ),
    );
  }
}
