using System.ComponentModel.DataAnnotations;

namespace GradPlatformApi.Model.DTOs
{
    public class CreateSupervisorRequestDto
    {
        [Required]
        public int ProjectId { get; set; }

        [Required]
        public int SupervisorId { get; set; }

    }
}
