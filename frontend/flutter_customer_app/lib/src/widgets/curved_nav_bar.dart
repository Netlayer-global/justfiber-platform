import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../core/theme.dart';

// ─────────────────────────────────────────────────────────────────────────────
//  CurvedNavBar
//
//  Flutter port of "Navbar Animation #1" by Marie Bernard / RadekVyM.
//  Curved cutout that holds the active icon in a purple circle.
//  Active uses filled icon, inactive uses outlined for a clean modern look.
// ─────────────────────────────────────────────────────────────────────────────

class CurvedNavItem {
  const CurvedNavItem({
    required this.activeIcon,
    required this.inactiveIcon,
  });
  final IconData activeIcon;
  final IconData inactiveIcon;
}

class CurvedNavBar extends StatefulWidget {
  const CurvedNavBar({
    super.key,
    required this.items,
    required this.currentIndex,
    required this.onTap,
    this.barColor = const Color(0xFF12121E),
    this.circleColor = kAccent,
    this.activeIconColor = Colors.white,
    this.inactiveIconColor = const Color(0x99FFFFFF),
    this.height = 78,
    this.bottomInset = 0,
  });

  final List<CurvedNavItem> items;
  final int currentIndex;
  final ValueChanged<int> onTap;

  final Color barColor;
  final Color circleColor;
  final Color activeIconColor;
  final Color inactiveIconColor;
  final double height;
  final double bottomInset;

  @override
  State<CurvedNavBar> createState() => _CurvedNavBarState();
}

class _CurvedNavBarState extends State<CurvedNavBar>
    with TickerProviderStateMixin {
  late final AnimationController _circleCtrl;
  late final AnimationController _iconCtrl;
  late Animation<double> _circleAnim;
  late Animation<double> _iconAnim;

  late double _circleFracFrom;
  late double _circleFracTo;
  late int _previousIndex;

  @override
  void initState() {
    super.initState();
    _previousIndex = widget.currentIndex;
    _circleFracFrom = _segmentCenterFrac(widget.currentIndex);
    _circleFracTo = _circleFracFrom;

    _circleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    )..value = 1.0;
    _iconCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    )..value = 1.0;

    _circleAnim =
        CurvedAnimation(parent: _circleCtrl, curve: Curves.easeOutBack);
    _iconAnim =
        CurvedAnimation(parent: _iconCtrl, curve: Curves.easeOutBack);
  }

  @override
  void didUpdateWidget(covariant CurvedNavBar old) {
    super.didUpdateWidget(old);
    if (old.currentIndex != widget.currentIndex) {
      _previousIndex = old.currentIndex;
      _circleFracFrom = _circleAnim.isCompleted
          ? _circleFracTo
          : _lerp(_circleFracFrom, _circleFracTo, _circleAnim.value);
      _circleFracTo = _segmentCenterFrac(widget.currentIndex);

      final diff =
          (widget.currentIndex - _previousIndex).abs().clamp(1, 5);
      final ms = (320 + 70 * (diff - 1)).clamp(320, 560).toInt();
      _circleCtrl.duration = Duration(milliseconds: ms);
      _iconCtrl.duration = Duration(milliseconds: ms);

      _circleCtrl.forward(from: 0);
      _iconCtrl.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _circleCtrl.dispose();
    _iconCtrl.dispose();
    super.dispose();
  }

  double _segmentCenterFrac(int index) {
    final n = widget.items.length;
    return (index + 0.5) / n;
  }

  double _lerp(double a, double b, double t) => a + (b - a) * t;

  @override
  Widget build(BuildContext context) {
    final totalHeight = widget.height + widget.bottomInset;
    return SizedBox(
      height: totalHeight,
      child: AnimatedBuilder(
        animation: Listenable.merge([_circleAnim, _iconAnim]),
        builder: (context, _) {
          final circleFrac =
              _lerp(_circleFracFrom, _circleFracTo, _circleAnim.value);
          return LayoutBuilder(builder: (context, constraints) {
            final w = constraints.maxWidth;
            final h = widget.height;
            final innerR = _innerRadius(h);
            final outerR = _outerRadius(h);
            final circleCenterX = circleFrac * w;
            final circleCenterY = innerR;

            return Stack(
              clipBehavior: Clip.none,
              children: [
                // Curved bar background
                Positioned.fill(
                  child: CustomPaint(
                    painter: _CurvedBarPainter(
                      barColor: widget.barColor,
                      circleColor: widget.circleColor,
                      circleCenterX: circleCenterX,
                      circleCenterY: circleCenterY,
                      innerRadius: innerR,
                      outerRadius: outerR,
                    ),
                  ),
                ),

                // Tab buttons — icons only, no labels
                Positioned(
                  left: 0,
                  right: 0,
                  top: 0,
                  height: h,
                  child: Row(
                    children: List.generate(widget.items.length, (i) {
                      final selected = i == widget.currentIndex;
                      final wasSelected = i == _previousIndex && !selected;

                      // Lifted icon sits in the circle (centered on circle Y)
                      // Default icon sits in the bar lower portion
                      final defaultY = _defaultIconY(h);
                      final liftedY = _liftedIconY(h);
                      double iconY;
                      if (selected) {
                        iconY = _lerp(defaultY, liftedY, _iconAnim.value);
                      } else if (wasSelected) {
                        iconY = _lerp(liftedY, defaultY, _iconAnim.value);
                      } else {
                        iconY = defaultY;
                      }

                      // Use filled icon when in the circle, outlined otherwise
                      final showFilled = selected;
                      final iconData = showFilled
                          ? widget.items[i].activeIcon
                          : widget.items[i].inactiveIcon;

                      return Expanded(
                        child: GestureDetector(
                          behavior: HitTestBehavior.opaque,
                          onTap: () {
                            if (i != widget.currentIndex) {
                              HapticFeedback.lightImpact();
                              widget.onTap(i);
                            }
                          },
                          child: SizedBox(
                            height: h,
                            child: Stack(
                              clipBehavior: Clip.none,
                              alignment: Alignment.topCenter,
                              children: [
                                Positioned(
                                  top: iconY,
                                  child: TweenAnimationBuilder<double>(
                                    duration:
                                        const Duration(milliseconds: 200),
                                    tween: Tween<double>(
                                        begin: 1.0,
                                        end: selected ? 1.0 : 1.0),
                                    builder: (_, scale, child) =>
                                        Transform.scale(
                                            scale: scale, child: child),
                                    child: Icon(
                                      iconData,
                                      size: selected ? 24 : 23,
                                      color: selected
                                          ? widget.activeIconColor
                                          : widget.inactiveIconColor,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }),
                  ),
                ),
              ],
            );
          });
        },
      ),
    );
  }

  // Same proportions as original Marie Bernard design
  static double _innerRadius(double h) => h / (11.0 / 4.0);
  static double _outerRadius(double h) => _innerRadius(h) + (h / 12.0);

  // Lifted icon: centered in the circle (icon size 24, half = 12)
  static double _liftedIconY(double h) => _innerRadius(h) - 12;

  // Default icon: centered vertically in the visible bar fill area
  static double _defaultIconY(double h) {
    final innerR = _innerRadius(h);
    return innerR + ((h - innerR - 23) / 2);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  CurvedBarPainter — bar shape with curved cutout + accent circle
// ─────────────────────────────────────────────────────────────────────────────

class _CurvedBarPainter extends CustomPainter {
  _CurvedBarPainter({
    required this.barColor,
    required this.circleColor,
    required this.circleCenterX,
    required this.circleCenterY,
    required this.innerRadius,
    required this.outerRadius,
  });

  final Color barColor;
  final Color circleColor;
  final double circleCenterX;
  final double circleCenterY;
  final double innerRadius;
  final double outerRadius;

  @override
  void paint(Canvas canvas, Size size) {
    final w = size.width;
    final h = size.height;

    final cx = circleCenterX;
    final cy = circleCenterY;

    final p6 = Offset(cx, cy + outerRadius);
    final y46 = p6.dy * (4.0 / 5.0);
    final c =
        math.pow(cx, 2) + math.pow(cy, 2) - math.pow(outerRadius, 2);
    final d =
        math.pow(2 * cx, 2) - (4 * (math.pow(y46, 2) - (2 * cy * y46) + c));
    final sqrtD = math.sqrt(d.toDouble().abs());
    final x1 = cx - sqrtD / 2;
    final x2 = cx + sqrtD / 2;
    final p4 = Offset(math.min(x1, x2), y46);
    final p8 = Offset(math.max(x1, x2), y46);

    final alpha = (math.pi / 2) - math.atan((cx - p4.dx) / (p4.dy - cy));
    final l = math.tan(alpha) * (p4.dy - cy);
    final p2 = Offset(p4.dx - l, innerRadius);
    final p10 = Offset(p8.dx + l, innerRadius);

    final p1 = Offset(p2.dx - (outerRadius - innerRadius), p2.dy);
    final p11 = Offset(p10.dx + (outerRadius - innerRadius), p10.dy);

    final scale = (outerRadius - innerRadius) /
        math.sqrt(math.pow(p4.dx - p2.dx, 2) + math.pow(p4.dy - p2.dy, 2));
    final pX = (p4.dx - p2.dx) * scale;
    final pY = (p4.dy - p2.dy) * scale;
    final p3 = Offset(p2.dx + pX, p2.dy + pY);
    final p9 = Offset(p10.dx - pX, p10.dy + pY);

    final t = (p6.dy - p3.dy) / (p4.dy - p3.dy);
    final x5 = p3.dx + (t * (p4.dx - p3.dx));
    final p5 = Offset(x5, p6.dy);
    final p7 = Offset(p6.dx + (p6.dx - x5), p6.dy);

    final path = Path()
      ..moveTo(0, innerRadius)
      ..lineTo(p1.dx, p1.dy)
      ..quadraticBezierTo(p2.dx, p2.dy, p3.dx, p3.dy)
      ..lineTo(p4.dx, p4.dy)
      ..quadraticBezierTo(p5.dx, p5.dy, p6.dx, p6.dy)
      ..quadraticBezierTo(p7.dx, p7.dy, p8.dx, p8.dy)
      ..lineTo(p9.dx, p9.dy)
      ..quadraticBezierTo(p10.dx, p10.dy, p11.dx, p11.dy)
      ..lineTo(w, innerRadius)
      ..lineTo(w, h)
      ..lineTo(0, h)
      ..close();

    final shadowPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.4)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 14);
    canvas.drawPath(path, shadowPaint);

    final barPaint = Paint()..color = barColor;
    canvas.drawPath(path, barPaint);

    final hlPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.06)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawPath(path, hlPaint);

    // Accent circle with halo
    final glowPaint = Paint()
      ..color = circleColor.withValues(alpha: 0.45)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 18);
    canvas.drawCircle(Offset(cx, cy), innerRadius + 5, glowPaint);

    // Top-light gradient for depth
    final circleRect = Rect.fromCircle(center: Offset(cx, cy), radius: innerRadius);
    final circlePaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: [
          circleColor,
          Color.alphaBlend(Colors.black.withValues(alpha: 0.18), circleColor),
        ],
      ).createShader(circleRect);
    canvas.drawCircle(Offset(cx, cy), innerRadius, circlePaint);

    // Subtle inner edge ring
    final ringPaint = Paint()
      ..color = Colors.white.withValues(alpha: 0.28)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1;
    canvas.drawCircle(Offset(cx, cy), innerRadius - 0.5, ringPaint);
  }

  @override
  bool shouldRepaint(covariant _CurvedBarPainter old) =>
      old.circleCenterX != circleCenterX ||
      old.circleCenterY != circleCenterY ||
      old.barColor != barColor ||
      old.circleColor != circleColor;
}
