import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

/// Wraps [child] with a subtle scale-down on press.
/// Use it around any tappable widget for tactile micro-animation feedback.
class PressableScale extends StatefulWidget {
  const PressableScale({
    super.key,
    required this.child,
    this.onTap,
    this.scale = 0.96,
    this.duration = const Duration(milliseconds: 90),
    this.haptic = false,
  });

  final Widget child;
  final VoidCallback? onTap;

  /// Scale factor at maximum press depth (default 0.96).
  final double scale;

  /// Animation duration for press down (release is the same).
  final Duration duration;

  /// Whether to trigger [HapticFeedback.lightImpact] on tap.
  final bool haptic;

  @override
  State<PressableScale> createState() => _PressableScaleState();
}

class _PressableScaleState extends State<PressableScale>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this, duration: widget.duration);
    _scaleAnim = Tween<double>(begin: 1.0, end: widget.scale)
        .animate(CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  void _onDown(TapDownDetails _) {
    if (widget.onTap == null) return;
    _ctrl.forward();
  }

  void _onUp(TapUpDetails _) => _ctrl.reverse();
  void _onCancel() => _ctrl.reverse();

  void _onTap() {
    if (widget.haptic) HapticFeedback.lightImpact();
    widget.onTap?.call();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: widget.onTap != null ? _onDown : null,
      onTapUp: _onUp,
      onTapCancel: _onCancel,
      onTap: widget.onTap != null ? _onTap : null,
      behavior: HitTestBehavior.opaque,
      child: ScaleTransition(
        scale: _scaleAnim,
        child: widget.child,
      ),
    );
  }
}
