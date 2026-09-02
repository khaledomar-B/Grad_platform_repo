using System.Linq;

namespace GradPlatformApi.Helpers
{
    public static class ValidationHelper
    {
        //===========================================
        // 1) فحص كلمة المرور
        //===========================================
        public static bool IsValidPassword(string password, out string errorMessage)
        {
            errorMessage = null;

            if (string.IsNullOrWhiteSpace(password))
            {
                errorMessage = "كلمة المرور مطلوبة.";
                return false;
            }

            if (password.Length < 8)
            {
                errorMessage = "كلمة المرور يجب أن تكون 8 أحرف على الأقل.";
                return false;
            }

            if (!password.Any(char.IsUpper))
            {
                errorMessage = "كلمة المرور يجب أن تحتوي على حرف كبير واحد على الأقل.";
                return false;
            }

            if (!password.Any(char.IsDigit))
            {
                errorMessage = "كلمة المرور يجب أن تحتوي على رقم واحد على الأقل.";
                return false;
            }

            if (!password.Any(ch => "!@#$%^&*()-_=+[]{};:'\",.<>/?".Contains(ch)))
            {
                errorMessage = "كلمة المرور يجب أن تحتوي على رمز خاص واحد على الأقل.";
                return false;
            }

            return true;
        }

        //===========================================
        // 2) فحص إيميل المشرف (دكتور رسمي أو Part-Time)
        //===========================================
        public static bool IsValidSupervisorEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return false;

            email = email.ToLower();

            // دكتور رسمي
            if (email.EndsWith("@yu.edu.jo"))
                return true;

            // دكتور Part-Time
            if (email.StartsWith("ptl_") && email.EndsWith("@yu.edu.jo"))
                return true;

            return false;
        }
        public static bool IsValidStudentEmail(string email, string universityId, out string error)
        {
            error = null;

            if (string.IsNullOrWhiteSpace(email))
            {
                error = "الإيميل مطلوب.";
                return false;
            }

            if (!email.EndsWith("@ses.yu.edu.jo"))
            {
                error = "الإيميل يجب أن ينتهي بـ @ses.yu.edu.jo";
                return false;
            }

            var prefix = email.Split('@')[0];

            if (prefix != universityId)
            {
                error = "يجب أن يحتوي الإيميل على الرقم الجامعي قبل @.";
                return false;
            }

            if (prefix.Length != 10 || !prefix.All(char.IsDigit))
            {
                error = "الرقم الجامعي في الإيميل يجب أن يتكوّن من 10 أرقام.";
                return false;
            }

            return true;
        }

    }
}
