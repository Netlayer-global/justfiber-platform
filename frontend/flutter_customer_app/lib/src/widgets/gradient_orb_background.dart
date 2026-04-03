import 'package:flutter/material.dart';

class GradientOrbBackground extends StatelessWidget {
  const GradientOrbBackground({super.key, required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: [Color(0xFFF8FBFF), Color(0xFFF3F7FD), Color(0xFFEAF2FB)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -120,
            right: -40,
            child: _Orb(
              size: 260,
              colors: [Color(0x331D9BF0), Color(0x001D9BF0)],
            ),
          ),
          Positioned(
            top: 120,
            left: -80,
            child: _Orb(
              size: 220,
              colors: [Color(0x220F4C81), Color(0x000F4C81)],
            ),
          ),
          Positioned(
            bottom: -80,
            right: -20,
            child: _Orb(
              size: 240,
              colors: [Color(0x2214B8A6), Color(0x0014B8A6)],
            ),
          ),
          child,
        ],
      ),
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb({required this.size, required this.colors});

  final double size;
  final List<Color> colors;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(colors: colors),
        ),
      ),
    );
  }
}
