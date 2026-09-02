using System.ComponentModel.DataAnnotations;

namespace GradPlatformApi.Model.DTOs
{
    public class SendMessageDto
    {
        [Required]
        public string Content { get; set; } = null!;
    }
}
