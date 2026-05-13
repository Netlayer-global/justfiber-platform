-keep class io.flutter.** { *; }
-keep class com.justfiber.** { *; }
-dontwarn com.google.firebase.**
-dontwarn com.google.android.play.**
-keep class com.google.android.play.** { *; }

-keepattributes *Annotation*
-dontwarn com.razorpay.**
-keep class com.razorpay.** { *; }
-optimizations !method/inlining/
-keepclasseswithmembers class * {
    public void onPayment*(...);
}
