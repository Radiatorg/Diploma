package com.verchuk.electro.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ManufacturerRequest {
    @NotBlank(message = "Название производителя обязательно")
    @Size(max = 150, message = "Название не длиннее 150 символов")
    private String name;

    @Size(max = 200, message = "Юридическое название не длиннее 200 символов")
    private String legalName;

    @Size(max = 4000, message = "Описание не длиннее 4000 символов")
    private String description;

    @Size(max = 500, message = "URL логотипа не длиннее 500 символов")
    private String logoUrl;

    @Size(max = 255, message = "Email не длиннее 255 символов")
    private String email;

    @Size(max = 500)
    private String websiteUrl;

    @Size(max = 500)
    private String socialVk;

    @Size(max = 500)
    private String socialTelegram;

    @Size(max = 500)
    private String socialYoutube;

    @Size(max = 500)
    private String socialInstagram;

    private Boolean active;
}
