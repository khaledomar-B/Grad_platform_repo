using System;

namespace GradPlatformApi.Model.Users
{
    public class Administrator
    {
        public int Id { get; set; }          // PK

        public string FullName { get; set; } = null!;

        // الدور أو الصلاحية (مثلاً: SystemAdmin, UniversityAdmin)
        public string Role { get; set; } = "Admin";

        public bool IsActive { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
