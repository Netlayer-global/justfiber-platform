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
          BoxShadow(color: Color(0x140F172A), blurRadius: 26, offset: Offset(0, 18)),
          BoxShadow(color: Color(0x0F93C5FD), blurRadius: 14, offset: Offset(0, 6)),
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
                  Color.alphaBlend(const Color(0x10FFFFFF), color ?? const Color(0xFFFFFFFF)),
                  Color.alphaBlend(const Color(0x0A2563EB), color ?? const Color(0xFFFFFFFF)),
                ],
              ),
          borderRadius: BorderRadius.circular(30),
          border: Border.all(color: borderColor ?? const Color(0x140F172A)),
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
                    colors: [Color(0x162563EB), Color(0x002563EB)],
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
