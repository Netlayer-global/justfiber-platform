import 'dart:math';
import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

// ── Glassmorphism card ─────────────────────────────────────────────────────────

class GlassCard extends StatelessWidget {
  const GlassCard({
    super.key,
    required this.child,
    this.radius = 24.0,
    this.blur = 18.0,
    this.padding,
    this.border,
    this.color,
    this.shadows,
  });

  final Widget child;
  final double radius;
  final double blur;
  final EdgeInsetsGeometry? padding;
  final Border? border;
  final Color? color;
  final List<BoxShadow>? shadows;

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding,
          decoration: BoxDecoration(
            color: color ?? Colors.white.withValues(alpha: 0.055),
            borderRadius: BorderRadius.circular(radius),
            border: border ??
                Border.all(color: Colors.white.withValues(alpha: 0.10)),
            boxShadow: shadows,
          ),
          child: child,
        ),
      ),
    );
  }
}

// ── 3-D perspective tilt card ──────────────────────────────────────────────────

class Tilt3DCard extends StatefulWidget {
  const Tilt3DCard({
    super.key,
    required this.child,
    this.maxTilt = 0.10,
    this.perspective = 0.0007,
    this.springDuration = const Duration(milliseconds: 500),
  });

  final Widget child;
  final double maxTilt;
  final double perspective;
  final Duration springDuration;

  @override
  State<Tilt3DCard> createState() => _Tilt3DCardState();
}

class _Tilt3DCardState extends State<Tilt3DCard>
    with SingleTickerProviderStateMixin {
  double _tx = 0;
  double _ty = 0;
  late final AnimationController _ctrl;
  late Animation<double> _ax;
  late Animation<double> _ay;
  bool _springing = false;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.springDuration);
    _ax = const AlwaysStoppedAnimation(0);
    _ay = const AlwaysStoppedAnimation(0);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _update(DragUpdateDetails d, Size size) {
    _springing = false;
    _ctrl.stop();
    setState(() {
      _ty = ((d.localPosition.dx / size.width) - 0.5)
          .clamp(-0.5, 0.5) *
          widget.maxTilt *
          2;
      _tx = (-((d.localPosition.dy / size.height) - 0.5))
          .clamp(-0.5, 0.5) *
          widget.maxTilt *
          2;
    });
  }

  void _springBack() {
    _springing = true;
    _ax = Tween<double>(begin: _tx, end: 0).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut));
    _ay = Tween<double>(begin: _ty, end: 0).animate(
        CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut));
    _ctrl
      ..reset()
      ..forward().then((_) {
        if (mounted) setState(() { _tx = 0; _ty = 0; _springing = false; });
      });
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(builder: (context, c) {
      final size = Size(c.maxWidth, c.maxHeight.isFinite ? c.maxHeight : 240.0);
      return GestureDetector(
        onPanUpdate: (d) => _update(d, size),
        onPanEnd: (_) => _springBack(),
        onPanCancel: _springBack,
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (_, child) {
            final rx = _springing ? _ax.value : _tx;
            final ry = _springing ? _ay.value : _ty;
            return Transform(
              transform: Matrix4.identity()
                ..setEntry(3, 2, widget.perspective)
                ..rotateX(rx)
                ..rotateY(ry),
              alignment: Alignment.center,
              child: child,
            );
          },
          child: widget.child,
        ),
      );
    });
  }
}

// ── Animated rotating gradient border ─────────────────────────────────────────

class AnimatedGradientBorder extends StatefulWidget {
  const AnimatedGradientBorder({
    super.key,
    required this.child,
    this.radius = 26.0,
    this.strokeWidth = 1.5,
    this.glowWidth = 4.0,
    this.colors = const [
      Color(0xFFBB6FF7),
      Color(0xFF7C3AED),
      Color(0xFF06B6D4),
      Color(0xFF7C3AED),
      Color(0xFFBB6FF7),
    ],
    this.duration = const Duration(seconds: 4),
  });

  final Widget child;
  final double radius;
  final double strokeWidth;
  final double glowWidth;
  final List<Color> colors;
  final Duration duration;

  @override
  State<AnimatedGradientBorder> createState() =>
      _AnimatedGradientBorderState();
}

class _AnimatedGradientBorderState extends State<AnimatedGradientBorder>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, child) => CustomPaint(
        painter: _GradientBorderPainter(
          progress: _ctrl.value,
          radius: widget.radius,
          strokeWidth: widget.strokeWidth,
          glowWidth: widget.glowWidth,
          colors: widget.colors,
        ),
        child: child,
      ),
      child: Padding(
        padding: EdgeInsets.all(widget.strokeWidth + 1),
        child: ClipRRect(
          borderRadius:
              BorderRadius.circular(widget.radius - widget.strokeWidth),
          child: widget.child,
        ),
      ),
    );
  }
}

class _GradientBorderPainter extends CustomPainter {
  const _GradientBorderPainter({
    required this.progress,
    required this.radius,
    required this.strokeWidth,
    required this.glowWidth,
    required this.colors,
  });

  final double progress;
  final double radius;
  final double strokeWidth;
  final double glowWidth;
  final List<Color> colors;

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Rect.fromLTWH(strokeWidth / 2, strokeWidth / 2,
        size.width - strokeWidth, size.height - strokeWidth);
    final rrect = RRect.fromRectAndRadius(rect, Radius.circular(radius));
    final start = progress * 2 * pi;

    final shader = SweepGradient(
      center: Alignment.center,
      startAngle: start,
      endAngle: start + 2 * pi,
      colors: colors,
    ).createShader(rect);

    // Glow layer
    canvas.drawRRect(
        rrect,
        Paint()
          ..shader = shader
          ..style = PaintingStyle.stroke
          ..strokeWidth = glowWidth
          ..maskFilter = MaskFilter.blur(BlurStyle.normal, glowWidth));

    // Sharp border
    canvas.drawRRect(
        rrect,
        Paint()
          ..shader = shader
          ..style = PaintingStyle.stroke
          ..strokeWidth = strokeWidth);
  }

  @override
  bool shouldRepaint(_GradientBorderPainter o) => o.progress != progress;
}

// ── Fade + slide entrance ──────────────────────────────────────────────────────

class FxFadeSlide extends StatelessWidget {
  const FxFadeSlide({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 440),
    this.offsetY = 0.06,
  });

  final Widget child;
  final Duration delay;
  final Duration duration;
  final double offsetY;

  @override
  Widget build(BuildContext context) {
    return child
        .animate(delay: delay)
        .fadeIn(duration: duration, curve: Curves.easeOutCubic)
        .slideY(begin: offsetY, end: 0, duration: duration,
            curve: Curves.easeOutCubic);
  }
}

/// Wraps a list item with staggered entrance. Use index to control delay.
Widget fxStagger(Widget child, int index, {int baseMs = 55}) => FxFadeSlide(
      delay: Duration(milliseconds: baseMs * index),
      child: child,
    );

// ── Scale pop entrance ────────────────────────────────────────────────────────

class FxScalePop extends StatelessWidget {
  const FxScalePop({
    super.key,
    required this.child,
    this.delay = Duration.zero,
    this.duration = const Duration(milliseconds: 500),
  });

  final Widget child;
  final Duration delay;
  final Duration duration;

  @override
  Widget build(BuildContext context) {
    return child
        .animate(delay: delay)
        .fadeIn(duration: duration, curve: Curves.easeOutCubic)
        .scale(
          begin: const Offset(0.88, 0.88),
          end: const Offset(1, 1),
          duration: duration,
          curve: Curves.elasticOut,
        );
  }
}

// ── Breathing glow orb ────────────────────────────────────────────────────────

class AnimatedOrb extends StatefulWidget {
  const AnimatedOrb({
    super.key,
    this.color = const Color(0xFF7C3AED),
    this.size = 200.0,
    this.opacity = 0.09,
    this.duration = const Duration(seconds: 4),
  });
  final Color color;
  final double size;
  final double opacity;
  final Duration duration;

  @override
  State<AnimatedOrb> createState() => _AnimatedOrbState();
}

class _AnimatedOrbState extends State<AnimatedOrb>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _anim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat(reverse: true);
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _anim,
      builder: (_, __) => Transform.scale(
        scale: 0.88 + _anim.value * 0.12,
        child: Container(
          width: widget.size,
          height: widget.size,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            gradient: RadialGradient(
              colors: [
                widget.color.withValues(alpha: widget.opacity),
                widget.color.withValues(alpha: widget.opacity * 0.4),
                Colors.transparent,
              ],
              stops: const [0.0, 0.5, 1.0],
            ),
          ),
        ),
      ),
    );
  }
}

// ── Animated counter (number roll) ────────────────────────────────────────────

class AnimatedCounter extends StatelessWidget {
  const AnimatedCounter({
    super.key,
    required this.value,
    this.prefix = '',
    this.suffix = '',
    this.style,
    this.duration = const Duration(milliseconds: 900),
    this.curve = Curves.easeOutCubic,
  });

  final double value;
  final String prefix;
  final String suffix;
  final TextStyle? style;
  final Duration duration;
  final Curve curve;

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: value),
      duration: duration,
      curve: curve,
      builder: (_, v, __) => Text(
        '$prefix${v.toStringAsFixed(0)}$suffix',
        style: style,
      ),
    );
  }
}

// ── Shimmer glow text ─────────────────────────────────────────────────────────

class ShimmerText extends StatefulWidget {
  const ShimmerText(
    this.text, {
    super.key,
    required this.style,
    this.colors = const [
      Color(0xFFBB6FF7),
      Colors.white,
      Color(0xFF7C3AED),
    ],
    this.duration = const Duration(seconds: 3),
  });

  final String text;
  final TextStyle style;
  final List<Color> colors;
  final Duration duration;

  @override
  State<ShimmerText> createState() => _ShimmerTextState();
}

class _ShimmerTextState extends State<ShimmerText>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration)
      ..repeat();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (_, __) => ShaderMask(
        shaderCallback: (bounds) => LinearGradient(
          colors: widget.colors,
          stops: [
            (_ctrl.value - 0.3).clamp(0.0, 1.0),
            _ctrl.value.clamp(0.0, 1.0),
            (_ctrl.value + 0.3).clamp(0.0, 1.0),
          ],
        ).createShader(bounds),
        blendMode: BlendMode.srcIn,
        child: Text(widget.text, style: widget.style),
      ),
    );
  }
}
