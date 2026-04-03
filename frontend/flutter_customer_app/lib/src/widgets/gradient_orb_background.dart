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
          colors: [Color(0xFFFBF7F2), Color(0xFFF7F1EB), Color(0xFFF3ECE4)],
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: -120,
            right: -40,
            child: _Orb(
              size: 260,
              colors: [Color(0x338224E3), Color(0x008224E3)],
            ),
          ),
          Positioned(
            top: 120,
            left: -80,
            child: _Orb(
              size: 220,
              colors: [Color(0x22A855F7), Color(0x00A855F7)],
            ),
          ),
          Positioned(
            bottom: -80,
            right: -20,
            child: _Orb(
              size: 240,
              colors: [Color(0x18A02D70), Color(0x00A02D70)],
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
