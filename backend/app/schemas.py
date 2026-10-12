from datetime import date
from typing import Literal
from urllib.parse import urlsplit
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from pydantic.alias_generators import to_camel

Status = Literal['Applied', 'Assessment', 'Interview', 'Offer', 'Rejected', 'Withdrawn']

class Schema(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, extra='forbid', str_strip_whitespace=True)

class ApplicationCreate(Schema):
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=120)
    status: Status = 'Applied'
    applied_on: date
    job_url: str | None = Field(default=None, max_length=2048)
    interview_date: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = Field(default=None, max_length=160)
    notes: str = Field(default='', max_length=20000)

    @field_validator('job_url', 'interview_date', 'follow_up_date', 'next_action', mode='before')
    @classmethod
    def blank_optional(cls, value):
        return None if isinstance(value, str) and not value.strip() else value

    @field_validator('job_url')
    @classmethod
    def valid_url(cls, value):
        if value is not None:
            try:
                u = urlsplit(value)
                if u.scheme not in ('http', 'https') or not u.hostname or u.username or u.password or any(c.isspace() for c in value):
                    raise ValueError()
                _ = u.port
            except ValueError:
                raise ValueError('Use a valid http:// or https:// URL without credentials')
        return value

class ApplicationPatch(ApplicationCreate):
    company: str | None = Field(default=None, min_length=1, max_length=100)
    role: str | None = Field(default=None, min_length=1, max_length=120)
    status: Status | None = None
    applied_on: date | None = None
    notes: str | None = Field(default=None, max_length=20000)

    @model_validator(mode='after')
    def required_cannot_be_null(self):
        for name in ('company','role','status','applied_on','notes'):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f'{name} cannot be null')
        return self

class EmailInput(Schema):
    subject: str = Field(min_length=1, max_length=300)
    sender: str | None = Field(default=None, max_length=320)
    received_at: date | None = None
    body: str = Field(min_length=1, max_length=20000)

    @field_validator('received_at', 'sender', mode='before')
    @classmethod
    def blank_optional(cls, v):
        return None if isinstance(v, str) and not v.strip() else v

class ImportFields(Schema):
    company: str = Field(min_length=1, max_length=100)
    role: str = Field(min_length=1, max_length=120)
    status: Status
    interview_date: date | None = None
    follow_up_date: date | None = None
    next_action: str | None = Field(default=None, max_length=160)
    _blank = field_validator('interview_date','follow_up_date','next_action', mode='before')(ApplicationCreate.blank_optional.__func__)

class ImportSave(Schema):
    email: EmailInput
    fields: ImportFields
    target_application_id: str | None = None
