import 'dart:math' as math;

import 'package:flutter/material.dart';

class GradientOrbBackground extends StatefulWidget {
  const GradientOrbBackground({super.key, required this.child});

  final Widget child;

  @override
  State<GradientOrbBackground> createState() =>
      _GradientOrbBackgroundState();
}

class _GradientOrbBackgroundState extends State<GradientOrbBackground>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _pulse;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 5),
    )..repeat(reverse: true);

    _pulse = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _pulse,
      builder: (context, _) {
        // Scale between 0.88 and 1.12 — subtle breathing
        final scale = 0.88 + 0.24 * _pulse.value;
        // Drift slightly (±18 px) for organic movement
        final drift =
            math.sin(_pulse.value * math.pi) * 18;

        return Stack(
          children: [
            // Background gradient
            const Positioned.fill(
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      Color(0xFF07070F),
                      Color(0xFF0E0E1A),
                      Color(0xFF120A24),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                ),
              ),
            ),

            // Top-right purple orb — pulses + drifts down
            Positioned(
              top: -100 + drift,
              right: -60,
              child: Transform.scale(
                scale: scale,
                child: const _Orb(
                  size: 340,
                  color: Color(0xFFA855F7),
                  opacity: 0.18,
                ),
              ),
            ),

            // Bottom-left cyan orb — counter-pulses
            Positioned(
              bottom: 80 - drift,
              left: -80,
              child: Transform.scale(
                scale: 1.12 - 0.24 * _pulse.value,
                child: const _Orb(
                  size: 280,
                  color: Color(0xFF22D3EE),
                  opacity: 0.07,
                ),
              ),
            ),

            // Extra subtle mid-screen violet accent
            Positioned(
              top: 260 + drift * 0.5,
              right: -120 + drift,
              child: Transform.scale(
                scale: 0.9 + 0.15 * _pulse.value,
                child: const _Orb(
                  size: 200,
                  color: Color(0xFF7C3AED),
                  opacity: 0.06,
                ),
              ),
            ),

            widget.child,
          ],
        );
      },
    );
  }
}

class _Orb extends StatelessWidget {
  const _Orb(
      {required this.size, required this.color, required this.opacity});

  final double size;
  final Color color;
  final double opacity;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              color.withValues(alpha: opacity),
              Colors.transparent,
            ],
          ),
        ),
      ),
    );
  }
}
