using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace GradPlatformApi.Migrations
{
    /// <inheritdoc />
    public partial class editprofile : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GithubLink",
                table: "ProfileDetails");

            migrationBuilder.DropColumn(
                name: "LinkedInLink",
                table: "ProfileDetails");

            migrationBuilder.DropColumn(
                name: "PortfolioLink",
                table: "ProfileDetails");

            migrationBuilder.RenameColumn(
                name: "ResumePath",
                table: "ProfileDetails",
                newName: "SkillsCsv");

            migrationBuilder.AddColumn<string>(
                name: "GitHubUrl",
                table: "ProfileDetails",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedInUrl",
                table: "ProfileDetails",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "GitHubUrl",
                table: "ProfileDetails");

            migrationBuilder.DropColumn(
                name: "LinkedInUrl",
                table: "ProfileDetails");

            migrationBuilder.RenameColumn(
                name: "SkillsCsv",
                table: "ProfileDetails",
                newName: "ResumePath");

            migrationBuilder.AddColumn<string>(
                name: "GithubLink",
                table: "ProfileDetails",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "LinkedInLink",
                table: "ProfileDetails",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PortfolioLink",
                table: "ProfileDetails",
                type: "nvarchar(max)",
                nullable: true);
        }
    }
}
