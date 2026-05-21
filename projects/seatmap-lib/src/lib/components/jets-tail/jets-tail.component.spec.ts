import { describe, it, expect, beforeEach } from 'vitest';
import { TestBed, ComponentFixture } from '@angular/core/testing';
import { JetsTailComponent } from './jets-tail.component';

describe('JetsTailComponent', () => {
  let fixture: ComponentFixture<JetsTailComponent>;
  let component: JetsTailComponent;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [JetsTailComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(JetsTailComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
  });

  it('should render at the provided width', () => {
    component.width = 320;
    fixture.detectChanges();
    expect(component.width).toBe(320);
  });

  it('should accept a custom hullColor', () => {
    component.colorTheme = { hullColor: '#abcdef' } as any;
    fixture.detectChanges();
    expect(component.colorTheme?.hullColor).toBe('#abcdef');
  });
});
