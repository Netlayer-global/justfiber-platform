-keep class io.flutter.** { *; }
-keep class com.justfiber.** { *; }
-dontwarn com.google.firebase.**

-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/
-keepclasseswithmembers class * {
    public void onPayment*(...);
}
