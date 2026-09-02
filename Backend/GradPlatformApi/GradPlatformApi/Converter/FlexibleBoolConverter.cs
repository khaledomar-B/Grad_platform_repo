using System;
using System.Text.Json;
using System.Text.Json.Serialization;

public class SafeFlexibleBoolConverter : JsonConverter<bool>
{
    public override bool Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        try
        {
            if (reader.TokenType == JsonTokenType.True) return true;
            if (reader.TokenType == JsonTokenType.False) return false;
            if (reader.TokenType == JsonTokenType.Null) return false;

            if (reader.TokenType == JsonTokenType.Number)
            {
                if (reader.TryGetInt32(out var n)) return n != 0;
            }

            if (reader.TokenType == JsonTokenType.String)
            {
                var s = (reader.GetString() ?? "").Trim().ToLowerInvariant();
                if (bool.TryParse(s, out var b)) return b;
                if (int.TryParse(s, out var n)) return n != 0;

                if (s is "passed" or "pass" or "ok" or "yes") return true;
                if (s is "failed" or "fail" or "no") return false;

                // لو عربي
                if (s is "ناجح" or "تم" or "صحيح") return true;
                if (s is "راسب" or "خطأ" or "غير صحيح") return false;
            }
        }
        catch { }

        // ✅ لا تكسر التطبيق، اعتبرها false
        return false;
    }

    public override void Write(Utf8JsonWriter writer, bool value, JsonSerializerOptions options)
        => writer.WriteBooleanValue(value);
}
