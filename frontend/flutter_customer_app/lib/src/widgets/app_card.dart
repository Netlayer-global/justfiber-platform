import 'package:flutter/material.dart';

import 'pressable_scale.dart';

const _kSurface = Color(0xFF0E0E1A);
const _kBorder = Color(0x0FFFFFFF);

class AppCard extends StatelessWidget {
  const AppCard({
    super.key,
    required this.child,
    this.gradient,
    this.color,
    this.borderColor,
    this.textColor,
    this.padding = const EdgeInsets.all(20),
    this.onTap,
  });

  final Widget child;
  final Gradient? gradient;
  final Color? color;
  final Color? borderColor;
  final Color? textColor;
  final EdgeInsetsGeometry padding;

  /// Optional tap handler — when provided the card animates on press.
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final card = DefaultTextStyle.merge(
      style:
          textColor != null ? TextStyle(color: textColor) : const TextStyle(),
      child: Container(
        padding: padding,
        decoration: BoxDecoration(
          gradient: gradient,
          color: gradient == null ? (color ?? _kSurface) : null,
          borderRadius: BorderRadius.circular(22),
          border: gradient == null
              ? Border.all(color: borderColor ?? _kBorder)
              : null,
          boxShadow: const [
            BoxShadow(
                color: Color(0x18000000),
                blurRadius: 24,
                offset: Offset(0, 8)),
          ],
        ),
        child: child,
      ),
    );

    if (onTap == null) return card;

    return PressableScale(onTap: onTap, haptic: true, child: card);
  }
}
