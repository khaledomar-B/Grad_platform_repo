namespace GradPlatformApi.Model.DTOs
{
    public class StudentRegisterDto
    {
        
            public string FirstName { get; set; } = string.Empty;
            public string LastName { get; set; } = string.Empty;

        // للطالب (10 أرقام)
            public string? UniversityId { get; set; }

            public string? Email { get; set; }

            public string Password { get; set; } = string.Empty;
            public string ConfirmPassword { get; set; } = string.Empty;

        
    }
}
